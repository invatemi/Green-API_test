import { createAction, createSlice } from '@reduxjs/toolkit'

import type { Credentials } from '@/shared/api/green-api'

import { notificationApplied } from '../notification/actions'

/** Сессия входа и флаг месячного лимита чатов. */
export interface SessionState {
  credentials: Credentials | null
  quotaExceeded: boolean
}

const initialState: SessionState = {
  credentials: null,
  quotaExceeded: false,
}

/** Сохраняет учётные данные и снимает флаг лимита прошлого входа. */
export const sessionLoggedIn = createAction<Credentials>('session/loggedIn')

/** Стирает сессию в памяти. Чаты в localStorage не затрагиваются. */
export const sessionLoggedOut = createAction('session/loggedOut')

/** Включает баннер лимита после ошибки отправки 466. */
export const quotaRaised = createAction('session/quotaRaised')

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(sessionLoggedIn, (state, action) => {
        state.credentials = action.payload
        state.quotaExceeded = false
      })
      .addCase(sessionLoggedOut, (state) => {
        state.credentials = null
        state.quotaExceeded = false
      })
      .addCase(quotaRaised, (state) => {
        state.quotaExceeded = true
      })
      .addCase(notificationApplied, (state, action) => {
        if (action.payload.type === 'quota') {
          state.quotaExceeded = true
        }
      })
  },
})

export const sessionReducer = sessionSlice.reducer

/**
 * Возвращает учётные данные текущей сессии.
 * @param state Состояние с веткой session.
 * @returns Пара полей входа или null.
 */
export function selectCredentials(state: { session: SessionState }): Credentials | null {
  return state.session.credentials
}

/**
 * Возвращает флаг исчерпанного лимита чатов.
 * @param state Состояние с веткой session.
 * @returns true, если лимит уже показан пользователю.
 */
export function selectQuotaExceeded(state: { session: SessionState }): boolean {
  return state.session.quotaExceeded
}
