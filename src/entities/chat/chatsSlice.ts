import { createAction, createSelector, createSlice } from '@reduxjs/toolkit'

import { notificationApplied } from '../notification/actions'
import type { NotificationEffect } from '../notification/apply'
import { emptyMailbox, type Chat, type ChatMessage, type Mailbox } from './model'

/** Чаты и сообщения одного idInstance. */
export interface ChatsState extends Mailbox {
  idInstance: string | null
}

const initialState: ChatsState = {
  idInstance: null,
  ...emptyMailbox(),
}

/** Подменяет ящик чатов при входе под конкретным инстансом. */
export const mailboxLoaded = createAction<{ idInstance: string } & Mailbox>('chats/mailboxLoaded')

/** Очищает ящик в памяти при выходе, не удаляя запись localStorage. */
export const mailboxCleared = createAction('chats/mailboxCleared')

/** Создаёт чат или только выбирает его, если chatId уже есть. */
export const chatUpserted = createAction<{ chatId: string; phone: string; updatedAt: number }>(
  'chats/chatUpserted',
)

/** Кладёт исходящее сообщение в статусе pending. */
export const outgoingAdded = createAction<ChatMessage>('chats/outgoingAdded')

/** Заменяет локальный id на idMessage API и ставит статус sent. */
export const outgoingResolved = createAction<{ localId: string; idMessage: string }>('chats/outgoingResolved')

/** Помечает исходящее сообщение как неотправленное. */
export const outgoingFailed = createAction<{ localId: string }>('chats/outgoingFailed')

/** Открывает чат, не меняя время последней активности. */
export const chatSelected = createAction<string>('chats/chatSelected')

/** Сбрасывает выбранный чат, чтобы на узком экране вернуться к списку. */
export const activeChatCleared = createAction('chats/activeChatCleared')

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(mailboxLoaded, (state, action) => {
        state.idInstance = action.payload.idInstance
        state.chats = action.payload.chats
        state.messages = action.payload.messages
        state.activeChatId = action.payload.activeChatId
      })
      .addCase(mailboxCleared, () => ({ idInstance: null, ...emptyMailbox() }))
      .addCase(chatUpserted, (state, action) => {
        upsertChat(state, action.payload)
        state.activeChatId = action.payload.chatId
      })
      .addCase(outgoingAdded, (state, action) => {
        state.messages.push(action.payload)
        bringChatForward(state, action.payload.chatId, action.payload.timestamp)
      })
      .addCase(outgoingResolved, (state, action) => {
        const message = state.messages.find((item) => item.idMessage === action.payload.localId)
        if (!message) {
          return
        }
        message.idMessage = action.payload.idMessage
        message.status = 'sent'
      })
      .addCase(outgoingFailed, (state, action) => {
        const message = state.messages.find((item) => item.idMessage === action.payload.localId)
        if (message) {
          message.status = 'failed'
        }
      })
      .addCase(chatSelected, (state, action) => {
        state.activeChatId = action.payload
        markChatRead(state, action.payload)
      })
      .addCase(activeChatCleared, (state) => {
        state.activeChatId = null
      })
      .addCase(notificationApplied, (state, action) => {
        if (action.payload.type === 'add-incoming') {
          applyIncoming(state, action.payload)
        }
      })
  },
})

export const chatsReducer = chatsSlice.reducer

/**
 * Возвращает чаты текущего ящика в порядке хранилища.
 * @param state Состояние с веткой chats.
 * @returns Список чатов.
 */
export function selectChats(state: { chats: ChatsState }): Chat[] {
  return state.chats.chats
}

/**
 * Возвращает идентификатор открытого чата.
 * @param state Состояние с веткой chats.
 * @returns chatId или null.
 */
export function selectActiveChatId(state: { chats: ChatsState }): string | null {
  return state.chats.activeChatId
}

/**
 * Возвращает сообщения открытого чата.
 * Новый массив считается только когда меняются лента или выбранный чат.
 * @param state Состояние с веткой chats.
 * @returns Сообщения активного чата в порядке ленты.
 */
export const selectActiveMessages = createSelector(
  [
    (state: { chats: ChatsState }) => state.chats.messages,
    (state: { chats: ChatsState }) => state.chats.activeChatId,
  ],
  (messages, activeChatId): ChatMessage[] => messages.filter((message) => message.chatId === activeChatId),
)

/** Строка списка: превью и непрочитанные уже посчитаны. */
export interface ChatRow {
  chatId: string
  phone: string
  preview: string
  unread: number
  active: boolean
}

/**
 * Собирает строки списка одним проходом по ленте.
 * Ссылка та же, пока не меняются чаты, сообщения или выбранный чат.
 * @param state Состояние с веткой chats.
 * @returns Строки в порядке списка чатов.
 */
export const selectChatRows = createSelector(
  [
    (state: { chats: ChatsState }) => state.chats.chats,
    (state: { chats: ChatsState }) => state.chats.messages,
    (state: { chats: ChatsState }) => state.chats.activeChatId,
  ],
  (chats, messages, activeChatId): ChatRow[] => {
    const summary = summarizeMessages(messages)

    return chats.map((chat) => {
      const row = summary.get(chat.chatId)

      return {
        chatId: chat.chatId,
        phone: chat.phone,
        preview: row?.preview ?? 'Нет сообщений',
        unread: row?.unread ?? 0,
        active: chat.chatId === activeChatId,
      }
    })
  },
)

/**
 * За один проход запоминает последний текст и число непрочитанных входящих.
 * @param messages Лента всех чатов.
 * @returns Сводка по chatId.
 */
function summarizeMessages(messages: ChatMessage[]): Map<string, { preview: string; unread: number }> {
  const summary = new Map<string, { preview: string; unread: number }>()

  for (const message of messages) {
    const current = summary.get(message.chatId) ?? { preview: '', unread: 0 }
    current.preview = message.text
    if (message.direction === 'in' && !message.read) {
      current.unread += 1
    }
    summary.set(message.chatId, current)
  }

  return summary
}

/**
 * Добавляет чат или поднимает существующий, не создавая дубль.
 * @param state Черновик ящика.
 * @param chat Данные чата.
 */
function upsertChat(state: ChatsState, chat: { chatId: string; phone: string; updatedAt: number }): void {
  const exists = state.chats.some((item) => item.chatId === chat.chatId)

  if (!exists) {
    state.chats.unshift({ chatId: chat.chatId, phone: chat.phone, updatedAt: chat.updatedAt })
    return
  }

  bringChatForward(state, chat.chatId, chat.updatedAt)
}

/**
 * Снимает непрочитанные входящие сообщения открытого чата.
 * @param state Черновик ящика.
 * @param chatId Идентификатор открытого чата.
 */
function markChatRead(state: ChatsState, chatId: string): void {
  for (const message of state.messages) {
    if (message.chatId === chatId) {
      message.read = true
    }
  }
}

/**
 * Ставит чат первым и обновляет время последней активности.
 * @param state Черновик ящика.
 * @param chatId Идентификатор чата.
 * @param updatedAt Новое время активности.
 */
function bringChatForward(state: ChatsState, chatId: string, updatedAt: number): void {
  const index = state.chats.findIndex((chat) => chat.chatId === chatId)

  if (index === -1) {
    return
  }

  const [chat] = state.chats.splice(index, 1)
  chat.updatedAt = updatedAt
  state.chats.unshift(chat)
}

/**
 * Кладёт входящий текст в ленту и при необходимости создаёт чат.
 * Повторный idMessage не добавляет второй пузырь.
 * @param state Черновик ящика.
 * @param effect Эффект add-incoming.
 */
function applyIncoming(
  state: ChatsState,
  effect: Extract<NotificationEffect, { type: 'add-incoming' }>,
): void {
  const known = state.chats.some((chat) => chat.chatId === effect.chatId)

  if (!known) {
    state.chats.unshift({
      chatId: effect.chatId,
      phone: effect.phone,
      telegramChatId: effect.telegramChatId,
      updatedAt: effect.message.timestamp,
    })
  } else {
    bringChatForward(state, effect.chatId, effect.message.timestamp)
    const chat = state.chats.find((item) => item.chatId === effect.chatId)
    if (chat) {
      chat.telegramChatId = effect.telegramChatId
    }
  }

  if (!state.activeChatId) {
    state.activeChatId = effect.chatId
  }

  const duplicate = state.messages.some((message) => message.idMessage === effect.message.idMessage)
  if (!duplicate) {
    state.messages.push({
      idMessage: effect.message.idMessage,
      chatId: effect.chatId,
      direction: effect.direction,
      text: effect.message.text,
      timestamp: effect.message.timestamp,
      status: 'sent',
      read: effect.direction === 'out' || state.activeChatId === effect.chatId,
    })
  }
}
