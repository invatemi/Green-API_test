import { describe, expect, it } from 'vitest'

import { createAppStore } from '@/app/store/createAppStore'
import { chatUpserted, mailboxLoaded } from '@/entities/chat/chatsSlice'
import { quotaRaised, sessionLoggedIn } from '@/entities/session/sessionSlice'
import { readMailbox } from '@/entities/storage/persist'
import type { MessageSender, NotificationQueue } from '@/shared/api/green-api'
import { createMemoryStorage } from '@/shared/lib/storage'

import { logout } from './logout'

const sender: MessageSender = {
  async sendText() {
    return { idMessage: 'unused' }
  },
}

const queue: NotificationQueue = {
  async receiveNotification() {
    return null
  },
  async deleteNotification() {
    return undefined
  },
}

describe('logout', () => {
  it('стирает сессию и ящик в памяти', async () => {
    const { store } = createStore()
    signIn(store)

    await store.dispatch(logout())

    expect(store.getState().session.credentials).toBeNull()
    expect(store.getState().chats).toMatchObject({ idInstance: null, chats: [], messages: [], activeChatId: null })
  })

  it('оставляет чаты в хранилище инстанса', async () => {
    const { store, local } = createStore()
    signIn(store)
    store.dispatch(chatUpserted({ chatId: '79876543210@c.us', phone: '79876543210', updatedAt: 1 }))

    await store.dispatch(logout())

    expect(readMailbox(local, '1100').chats).toHaveLength(1)
    expect(store.getState().chats.chats).toEqual([])
  })

  it('сбрасывает флаг месячного лимита', async () => {
    const { store } = createStore()
    signIn(store)
    store.dispatch(quotaRaised())

    await store.dispatch(logout())

    expect(store.getState().session.quotaExceeded).toBe(false)
  })
})

/**
 * Кладёт в store сессию одного инстанса.
 * @param store Store сценария.
 */
function signIn(store: ReturnType<typeof createStore>['store']): void {
  store.dispatch(sessionLoggedIn({ idInstance: '1100', apiTokenInstance: 'token' }))
  store.dispatch(mailboxLoaded({ idInstance: '1100', chats: [], messages: [], activeChatId: null }))
}

/**
 * Собирает store с памятью вместо браузерного storage.
 * @returns Store и хранилище чатов.
 */
function createStore() {
  const local = createMemoryStorage()
  const store = createAppStore({
    sender,
    queue,
    settings: {
      async enableIncomingQueue() {
        return undefined
      },
    },
    session: createMemoryStorage(),
    local,
  })

  return { store, local }
}
