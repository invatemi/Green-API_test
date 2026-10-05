import { describe, expect, it } from 'vitest'

import { notificationApplied } from '../notification/actions'
import {
  quotaRaised,
  selectCredentials,
  selectQuotaExceeded,
  sessionLoggedIn,
  sessionLoggedOut,
  sessionReducer,
} from './sessionSlice'

const credentials = { idInstance: '1100', apiTokenInstance: 'token' }

describe('sessionSlice', () => {
  it('вход сохраняет учётные данные и сбрасывает флаг лимита', () => {
    const raised = sessionReducer(undefined, quotaRaised())
    const logged = sessionReducer(raised, sessionLoggedIn(credentials))

    expect(selectCredentials({ session: logged })).toEqual(credentials)
    expect(selectQuotaExceeded({ session: logged })).toBe(false)
  })

  it('выход стирает сессию и флаг лимита', () => {
    const logged = sessionReducer(undefined, sessionLoggedIn(credentials))
    const raised = sessionReducer(logged, quotaRaised())
    const loggedOut = sessionReducer(raised, sessionLoggedOut())

    expect(loggedOut).toEqual({ credentials: null, quotaExceeded: false })
  })

  it('уведомление quotaExceeded поднимает флаг, чужое уведомление — нет', () => {
    const quota = sessionReducer(undefined, notificationApplied({ type: 'quota' }))
    const ignored = sessionReducer(
      undefined,
      notificationApplied({
        type: 'add-incoming',
        chatId: '79876543210@c.us',
        phone: '79876543210',
        telegramChatId: '79876543210@c.us',
        direction: 'in',
        createChat: true,
        message: { idMessage: 'm1', text: 'Привет', timestamp: 1 },
      }),
    )

    expect(quota.quotaExceeded).toBe(true)
    expect(ignored.quotaExceeded).toBe(false)
  })
})
