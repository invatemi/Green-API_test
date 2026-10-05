import { createAsyncThunk } from '@reduxjs/toolkit'

import { chatUpserted } from '@/entities/chat'
import type { MessengerState } from '@/entities'
import { normalizePhone } from '@/shared/lib'

/**
 * Создаёт локальный чат по номеру или выбирает уже существующий.
 * Запрос в API здесь не уходит: лимит тарифа проверяется при отправке.
 */
export const createChat = createAsyncThunk<void, string, { state: MessengerState; rejectValue: string }>(
  'chats/createChat',
  async (input, { dispatch, getState, rejectWithValue }) => {
    const phone = normalizePhone(input)

    if (!phone.ok) {
      return rejectWithValue(phone.reason)
    }

    if (!getState().session.credentials) {
      return rejectWithValue('Сначала войдите')
    }

    dispatch(chatUpserted({ chatId: phone.chatId, phone: phone.phone, updatedAt: Date.now() }))
  },
)
