import { createAsyncThunk } from '@reduxjs/toolkit'

import type { MessengerState } from '@/entities'
import type { ChatMessage } from '@/entities/chat'
import { applyNotification, notificationApplied, type PendingOutgoing } from '@/entities/notification'
import { quotaRaised } from '@/entities/session'
import type { AppDeps } from '@/shared/api/deps'
import { QuotaExceededError } from '@/shared/api/green-api'

/** Инстансы, для которых входящая очередь уже включена в этой вкладке. */
const readyInstances = new Set<string>()

/**
 * Забирает одно уведомление, применяет политику и удаляет его из очереди.
 * Удаление идёт после dispatch: при сбое запроса квитанция остаётся в очереди.
 */
export const receiveNext = createAsyncThunk<void, void, { state: MessengerState; extra: AppDeps }>(
  'notifications/receiveNext',
  async (_, { dispatch, extra, getState, signal }) => {
    const credentials = getState().session.credentials
    if (!credentials) {
      return
    }

    const idInstance = credentials.idInstance

    try {
      if (!readyInstances.has(idInstance)) {
        await extra.settings.enableIncomingQueue(credentials)
        readyInstances.add(idInstance)
      }

      if (!sameInstance(getState(), idInstance)) {
        return
      }

      const notification = await extra.queue.receiveNotification(credentials, signal)
      // Квитанция чужого инстанса остаётся в его очереди: ответ мог прийти уже после смены сессии.
      if (!notification || !sameInstance(getState(), idInstance)) {
        return
      }

      const state = getState()
      const effect = applyNotification(notification.body, {
        chats: state.chats.chats.map((chat) => ({
          chatId: chat.chatId,
          phone: chat.phone,
          telegramChatId: chat.telegramChatId,
        })),
        messageIds: state.chats.messages.map((message) => message.idMessage),
        pendingOutgoing: pendingOutgoing(state.chats.messages),
      })

      dispatch(notificationApplied(effect))
      if (!sameInstance(getState(), idInstance)) {
        return
      }

      await extra.queue.deleteNotification(credentials, notification.receiptId, signal)
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        dispatch(quotaRaised())
      }
      throw error
    }
  },
)

/**
 * Проверяет, что сессия всё ещё принадлежит инстансу, который начал опрос.
 * @param state Состояние после await.
 * @param idInstance Идентификатор инстанса на старте шага.
 * @returns true, если вход не сменился.
 */
function sameInstance(state: MessengerState, idInstance: string): boolean {
  return state.session.credentials?.idInstance === idInstance
}

/**
 * Собирает исходящие, чей серверный id ещё не пришёл.
 * @param messages Лента текущего ящика.
 * @returns Локальные id, чат и текст для дедупликации эха.
 */
function pendingOutgoing(messages: readonly ChatMessage[]): PendingOutgoing[] {
  return messages
    .filter((message) => message.direction === 'out' && message.status === 'pending')
    .map((message) => ({
      idMessage: message.idMessage,
      chatId: message.chatId,
      text: message.text,
    }))
}
