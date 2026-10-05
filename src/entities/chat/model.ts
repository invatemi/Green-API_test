/** Личный чат, созданный по номеру телефона. */
export interface Chat {
  chatId: string
  phone: string
  updatedAt: number
  telegramChatId?: string
}

/** Направление сообщения относительно пользователя сайта. */
export type MessageDirection = 'in' | 'out'

/** Статус исходящего сообщения. Входящие сразу получают sent. */
export type MessageStatus = 'pending' | 'sent' | 'failed'

/** Текстовое сообщение в ленте чата. */
export interface ChatMessage {
  idMessage: string
  chatId: string
  direction: MessageDirection
  text: string
  timestamp: number
  status: MessageStatus
  read: boolean
}

/** Снимок чатов одного инстанса без идентификатора инстанса. */
export interface Mailbox {
  chats: Chat[]
  messages: ChatMessage[]
  activeChatId: string | null
}

/**
 * Возвращает пустой ящик чатов.
 * @returns Почтовый ящик без чатов и активного выбора.
 */
export function emptyMailbox(): Mailbox {
  return { chats: [], messages: [], activeChatId: null }
}
