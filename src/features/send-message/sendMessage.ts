import { createAsyncThunk } from '@reduxjs/toolkit'

import type { MessengerState } from '@/entities'
import { outgoingAdded, outgoingFailed, outgoingResolved } from '@/entities/chat'
import { quotaRaised } from '@/entities/session'
import type { AppDeps } from '@/shared/api/deps'
import { ApiError, QuotaExceededError } from '@/shared/api/green-api'
import { validateMessageText } from '@/shared/lib'

/** Причина, по которой отправка не завершилась успехом. */
export interface SendFailure {
  skipped: boolean
  reason: string
  quota: boolean
}

/**
 * Проверяет текст, кладёт исходящее в ленту и отправляет его через порт.
 */
export const sendMessage = createAsyncThunk<
  void,
  { chatId: string; text: string },
  { state: MessengerState; extra: AppDeps; rejectValue: SendFailure }
>('chats/sendMessage', async ({ chatId, text }, { dispatch, extra, getState, rejectWithValue }) => {
  const validated = validateMessageText(text)

  if (!validated.ok) {
    return rejectWithValue({ skipped: true, reason: validated.reason, quota: false })
  }

  const credentials = getState().session.credentials
  if (!credentials) {
    return rejectWithValue({ skipped: true, reason: 'Сначала войдите', quota: false })
  }

  const localId = crypto.randomUUID()
  dispatch(
    outgoingAdded({
      idMessage: localId,
      chatId,
      direction: 'out',
      text: validated.text,
      timestamp: Date.now(),
      status: 'pending',
      read: true,
    }),
  )

  try {
    const sent = await extra.sender.sendText(credentials, chatId, validated.text)
    dispatch(outgoingResolved({ localId, idMessage: sent.idMessage }))
  } catch (error) {
    dispatch(outgoingFailed({ localId }))

    if (error instanceof QuotaExceededError) {
      dispatch(quotaRaised())
      return rejectWithValue({ skipped: false, reason: error.message, quota: true })
    }

    if (error instanceof ApiError) {
      return rejectWithValue({ skipped: false, reason: error.message, quota: false })
    }

    return rejectWithValue({ skipped: false, reason: 'Не удалось отправить сообщение', quota: false })
  }
})
