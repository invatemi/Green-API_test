import { isRecord } from '@/shared/lib'

/** Данные входящего текста, которые редьюсер кладёт в ленту. */
export interface IncomingText {
  idMessage: string
  text: string
  timestamp: number
}

/** Решение политики: что сделать с телом уведомления. */
export type NotificationEffect =
  | {
      type: 'add-incoming'
      chatId: string
      phone: string
      telegramChatId: string
      direction: 'in' | 'out'
      createChat: boolean
      message: IncomingText
    }
  | { type: 'quota' }
  | { type: 'ignore' }

/** Чат, с которым можно сопоставить входящее уведомление Telegram. */
export interface KnownChat {
  chatId: string
  phone: string
  telegramChatId?: string
}

/** Исходящее, чей серверный id ещё не записан. */
export interface PendingOutgoing {
  idMessage: string
  chatId: string
  text: string
}

/** Уже известные чаты и idMessage, чтобы не дублировать пузыри. */
export interface MailboxSnapshot {
  chats: readonly KnownChat[]
  messageIds: readonly string[]
  pendingOutgoing?: readonly PendingOutgoing[]
}

/**
 * Решает, как обработать тело уведомления, не выполняя запросов.
 * Повторный idMessage даёт ignore: пузырь уже есть после отправки или прошлого опроса.
 * @param body Поле body из очереди HTTP API.
 * @param snapshot Текущие чаты и идентификаторы сообщений.
 * @returns Описание изменения для редьюсера. ignore всё равно удаляется из очереди.
 */
export function applyNotification(body: unknown, snapshot: MailboxSnapshot): NotificationEffect {
  if (!isRecord(body)) {
    return { type: 'ignore' }
  }

  if (body.typeWebhook === 'quotaExceeded') {
    return { type: 'quota' }
  }

  const direction = readDirection(body.typeWebhook)
  if (!direction) {
    return { type: 'ignore' }
  }

  const text = isRecord(body.messageData) ? readText(body.messageData) : null
  const personal = readPersonalChat(body.senderData)
  const idMessage = typeof body.idMessage === 'string' ? body.idMessage : ''

  if (text === null || !personal || !idMessage || snapshot.messageIds.includes(idMessage)) {
    return { type: 'ignore' }
  }

  const sendChatId = personal.phone ? `${personal.phone}@c.us` : personal.rawChatId
  const existing = snapshot.chats.find((chat) => matchesChat(chat, personal, sendChatId))
  const chatId = resolvePersonalChatId(sendChatId, existing)
  if (!chatId) {
    return { type: 'ignore' }
  }

  // Эхо API может прийти раньше подмены локального UUID: сравнение только по idMessage его не видит.
  if (body.typeWebhook === 'outgoingAPIMessageReceived' && matchesPendingEcho(snapshot.pendingOutgoing, chatId, text)) {
    return { type: 'ignore' }
  }

  return {
    type: 'add-incoming',
    chatId,
    phone: personal.phone || existing?.phone || personal.rawChatId,
    telegramChatId: personal.rawChatId,
    direction,
    createChat: !existing,
    message: {
      idMessage,
      text,
      timestamp: typeof body.timestamp === 'number' ? body.timestamp : 0,
    },
  }
}

/**
 * Отличает входящий текст от исходящего, отправленного с сайта или из Telegram.
 * @param typeWebhook Тип уведомления.
 * @returns Направление сообщения или null, если это не текст переписки.
 */
function readDirection(typeWebhook: unknown): 'in' | 'out' | null {
  if (typeWebhook === 'incomingMessageReceived') {
    return 'in'
  }

  if (typeWebhook === 'outgoingMessageReceived' || typeWebhook === 'outgoingAPIMessageReceived') {
    return 'out'
  }

  return null
}

/**
 * Достаёт текст только из текстовых типов сообщения.
 * @param messageData Блок messageData уведомления.
 * @returns Текст или null для файла, голоса, стикера и пустого блока.
 */
function readText(messageData: Record<string, unknown>): string | null {
  if (messageData.typeMessage === 'textMessage' && isRecord(messageData.textMessageData)) {
    const text = messageData.textMessageData.textMessage
    return typeof text === 'string' ? text : null
  }

  if (messageData.typeMessage === 'extendedTextMessage' && isRecord(messageData.extendedTextMessageData)) {
    const text = messageData.extendedTextMessageData.text
    return typeof text === 'string' ? text : null
  }

  return null
}

/** Личный чат из уведомления Telegram. Группы сюда не попадают. */
interface PersonalChat {
  rawChatId: string
  phone: string
}

/**
 * Читает личный чат. Telegram присылает числовой chatId и телефон отдельно.
 * @param senderData Блок senderData уведомления.
 * @returns Идентификатор чата и телефон либо null для группы и канала.
 */
function readPersonalChat(senderData: unknown): PersonalChat | null {
  if (!isRecord(senderData) || typeof senderData.chatId !== 'string' || !senderData.chatId) {
    return null
  }

  if (isGroupChat(senderData.chatType, senderData.chatId)) {
    return null
  }

  if (senderData.chatId.endsWith('@c.us')) {
    return {
      rawChatId: senderData.chatId,
      phone: senderData.chatId.slice(0, -'@c.us'.length),
    }
  }

  return { rawChatId: senderData.chatId, phone: readPhone(senderData.senderPhoneNumber) }
}

/**
 * Отличает личный чат от группы, супергруппы и канала.
 * @param chatType Поле chatType, если оно есть.
 * @param chatId Идентификатор чата. У групп он начинается с минуса.
 * @returns true, если это не личная переписка.
 */
function isGroupChat(chatType: unknown, chatId: string): boolean {
  return chatType === 'group' || chatType === 'supergroup' || chatType === 'channel' || chatId.startsWith('-')
}

/**
 * Достаёт телефон отправителя. Ноль означает скрытый номер.
 * @param value Поле senderPhoneNumber.
 * @returns Цифры номера или пустая строка.
 */
function readPhone(value: unknown): string {
  if (typeof value === 'number' && value > 0) {
    return String(value)
  }

  if (typeof value === 'string' && /^\d{10,15}$/.test(value)) {
    return value
  }

  return ''
}

/**
 * Оставляет только chatId личного чата с суффиксом @c.us.
 * Сырой числовой id Telegram без телефона сюда не подходит.
 * @param sendChatId Идентификатор, которым ушло бы сообщение.
 * @param existing Уже известный чат, если он нашёлся.
 * @returns chatId для ленты или null, если ответить в личный чат нельзя.
 */
function resolvePersonalChatId(sendChatId: string, existing: KnownChat | undefined): string | null {
  if (existing?.chatId.endsWith('@c.us')) {
    return existing.chatId
  }

  if (sendChatId.endsWith('@c.us')) {
    return sendChatId
  }

  return null
}

/**
 * Ищет незавершённую отправку с тем же текстом в том же чате.
 * @param pending Исходящие в статусе pending. Пустое поле снимка значит, что таких нет.
 * @param chatId chatId личного чата.
 * @param text Текст эха.
 * @returns true, если пузырь уже лежит в ленте.
 */
function matchesPendingEcho(
  pending: readonly PendingOutgoing[] | undefined,
  chatId: string,
  text: string,
): boolean {
  return (pending ?? []).some((item) => item.chatId === chatId && item.text === text)
}

/**
 * Ищет уже созданный чат по номеру или по числовому id Telegram.
 * @param chat Чат из ящика.
 * @param personal Личный чат из уведомления.
 * @param sendChatId chatId, которым мы отправляем сообщения на номер.
 * @returns true, если уведомление относится к этому чату.
 */
function matchesChat(chat: KnownChat, personal: PersonalChat, sendChatId: string): boolean {
  return (
    chat.chatId === sendChatId ||
    chat.chatId === personal.rawChatId ||
    (personal.phone !== '' && chat.phone === personal.phone) ||
    chat.telegramChatId === personal.rawChatId
  )
}
