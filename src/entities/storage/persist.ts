import { isRecord, type KeyValueStorage } from '@/shared/lib'
import type { Credentials } from '@/shared/api/green-api'

import { emptyMailbox, type Chat, type ChatMessage, type Mailbox } from '../chat/model'
import type { SessionState } from '../session/sessionSlice'
import type { MessengerState } from '../state'

/** Ключ сессии во вкладке. Токен живёт только здесь. */
export const SESSION_KEY = 'green-api:session'

/**
 * Ключ ящика чатов конкретного инстанса.
 * @param idInstance Идентификатор инстанса.
 * @returns Ключ localStorage.
 */
export function chatsStorageKey(idInstance: string): string {
  return `green-api:chats:${idInstance}`
}

/**
 * Читает ящик чатов одного инстанса.
 * @param storage localStorage или его замена.
 * @param idInstance Идентификатор инстанса.
 * @returns Сохранённый ящик или пустой.
 */
export function readMailbox(storage: KeyValueStorage, idInstance: string): Mailbox {
  return parseMailbox(storage.get(chatsStorageKey(idInstance)))
}

/**
 * Собирает начальное состояние store из зеркал storage.
 * @param sessionStore Хранилище вкладки.
 * @param localStore Хранилище чатов.
 * @returns Состояние сессии и ящика текущего инстанса.
 */
export function readInitialState(sessionStore: KeyValueStorage, localStore: KeyValueStorage): MessengerState {
  const session = readSession(sessionStore)
  const idInstance = session.credentials?.idInstance ?? null
  const mailbox = idInstance ? readMailbox(localStore, idInstance) : emptyMailbox()

  return {
    session,
    chats: { idInstance, ...mailbox },
  }
}

/**
 * Записывает сессию и ящик текущего инстанса.
 * Выход удаляет ключ сессии и не стирает чаты других входов.
 * @param state Текущее состояние.
 * @param sessionStore Хранилище вкладки.
 * @param localStore Хранилище чатов.
 */
export function persistSnapshot(
  state: MessengerState,
  sessionStore: KeyValueStorage,
  localStore: KeyValueStorage,
): void {
  if (state.session.credentials) {
    sessionStore.set(
      SESSION_KEY,
      JSON.stringify({
        credentials: state.session.credentials,
        quotaExceeded: state.session.quotaExceeded,
      }),
    )
  } else {
    sessionStore.remove(SESSION_KEY)
  }

  if (!state.chats.idInstance) {
    return
  }

  const mailbox: Mailbox = {
    chats: state.chats.chats,
    messages: state.chats.messages,
    activeChatId: state.chats.activeChatId,
  }
  localStore.set(chatsStorageKey(state.chats.idInstance), JSON.stringify(mailbox))
}

/**
 * Читает сессию из хранилища вкладки.
 * @param storage sessionStorage или его замена.
 * @returns Сессия или пустое состояние.
 */
function readSession(storage: KeyValueStorage): SessionState {
  const raw = storage.get(SESSION_KEY)
  if (!raw) {
    return { credentials: null, quotaExceeded: false }
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || !isCredentials(parsed.credentials)) {
      return { credentials: null, quotaExceeded: false }
    }

    return {
      credentials: parsed.credentials,
      quotaExceeded: parsed.quotaExceeded === true,
    }
  } catch {
    return { credentials: null, quotaExceeded: false }
  }
}

/**
 * Разбирает JSON ящика и отбрасывает битые записи.
 * @param raw Строка из storage.
 * @returns Валидный ящик.
 */
function parseMailbox(raw: string | null): Mailbox {
  if (!raw) {
    return emptyMailbox()
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) {
      return emptyMailbox()
    }

    const chats = Array.isArray(parsed.chats) ? parsed.chats.filter(isChat) : []
    const messages = Array.isArray(parsed.messages) ? parsed.messages.flatMap(toMessage) : []
    // Выбор только из списка чатов: битый activeChatId открывал пустую переписку.
    const activeChatId =
      typeof parsed.activeChatId === 'string' && chats.some((chat) => chat.chatId === parsed.activeChatId)
        ? parsed.activeChatId
        : null

    return { chats, messages, activeChatId }
  } catch {
    return emptyMailbox()
  }
}

/**
 * Проверяет учётные данные.
 * @param value Значение из JSON.
 * @returns true, если оба поля — непустые строки.
 */
function isCredentials(value: unknown): value is Credentials {
  return isRecord(value) && typeof value.idInstance === 'string' && typeof value.apiTokenInstance === 'string'
}

/**
 * Проверяет запись чата.
 * @param value Значение из JSON.
 * @returns true, если форма чата полная.
 */
function isChat(value: unknown): value is Chat {
  return (
    isRecord(value) &&
    typeof value.chatId === 'string' &&
    typeof value.phone === 'string' &&
    typeof value.updatedAt === 'number'
  )
}

/**
 * Приводит запись сообщения к модели и считает старые исходящие прочитанными.
 * Незавершённая отправка не переживает перезагрузку: запрос уже оборван.
 * @param value Значение из JSON.
 * @returns Сообщение или пустой список для flatMap.
 */
function toMessage(value: unknown): ChatMessage[] {
  if (!isMessage(value)) {
    return []
  }

  return [
    {
      ...value,
      status: value.status === 'pending' ? 'failed' : value.status,
      read: value.read === true || value.direction === 'out',
    },
  ]
}

/**
 * Проверяет запись сообщения.
 * @param value Значение из JSON.
 * @returns true, если форма сообщения полная.
 */
function isMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value.idMessage === 'string' &&
    typeof value.chatId === 'string' &&
    (value.direction === 'in' || value.direction === 'out') &&
    typeof value.text === 'string' &&
    typeof value.timestamp === 'number' &&
    (value.status === 'pending' || value.status === 'sent' || value.status === 'failed')
  )
}
