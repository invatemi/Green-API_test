import { createAsyncThunk } from '@reduxjs/toolkit'

import { mailboxCleared } from '@/entities/chat'
import { sessionLoggedOut } from '@/entities/session'

/**
 * Стирает сессию в store. Запись чатов в localStorage остаётся.
 */
export const logout = createAsyncThunk('session/logout', async (_, { dispatch }) => {
  dispatch(sessionLoggedOut())
  dispatch(mailboxCleared())
})
