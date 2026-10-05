import { createAsyncThunk } from '@reduxjs/toolkit'

import { mailboxLoaded } from '@/entities/chat'
import { sessionLoggedIn } from '@/entities/session'
import { readMailbox } from '@/entities/storage'
import type { AppDeps } from '@/shared/api/deps'

/** Поля формы входа. */
export interface LoginInput {
  idInstance: string
  apiTokenInstance: string
}

/**
 * Сохраняет учётные данные и подгружает ящик этого инстанса.
 */
export const login = createAsyncThunk<void, LoginInput, { extra: AppDeps; rejectValue: string }>(
  'session/login',
  async (input, { dispatch, extra, rejectWithValue }) => {
    const idInstance = input.idInstance.trim()
    const apiTokenInstance = input.apiTokenInstance.trim()

    if (!idInstance || !apiTokenInstance) {
      return rejectWithValue('Введите idInstance и apiTokenInstance')
    }

    const mailbox = readMailbox(extra.local, idInstance)
    dispatch(sessionLoggedIn({ idInstance, apiTokenInstance }))
    dispatch(mailboxLoaded({ idInstance, ...mailbox }))
  },
)
