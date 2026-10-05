import { describe, expect, it } from 'vitest'

import { createAppStore } from '@/app/store/createAppStore'
import { chatsStorageKey, SESSION_KEY } from '@/entities/storage/persist'
import type { MessageSender, NotificationQueue } from '@/shared/api/green-api'
import { createMemoryStorage } from '@/shared/lib/storage'

import { login } from './login'

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

describe('login', () => {
  it('обрезает пробелы и поднимает ящик этого инстанса', async () => {
    const { store, local } = createStore()
    local.set(
      chatsStorageKey('1100'),
      JSON.stringify({
        chats: [{ chatId: '79876543210@c.us', phone: '79876543210', updatedAt: 1 }],
        messages: [],
        activeChatId: '79876543210@c.us',
      }),
    )

    const result = await store.dispatch(login({ idInstance: ' 1100 ', apiTokenInstance: ' token ' }))

    expect(login.fulfilled.match(result)).toBe(true)
    expect(store.getState().session.credentials).toEqual({ idInstance: '1100', apiTokenInstance: 'token' })
    expect(store.getState().chats.chats.map((chat) => chat.chatId)).toEqual(['79876543210@c.us'])
    expect(store.getState().chats.idInstance).toBe('1100')
  })

  it('отклоняет пустые поля и не создаёт сессию', async () => {
    const { store } = createStore()

    const result = await store.dispatch(login({ idInstance: ' ', apiTokenInstance: 'secret' }))

    expect(result.payload).toBe('Введите idInstance и apiTokenInstance')
    expect(store.getState().session.credentials).toBeNull()
    expect(store.getState().chats.idInstance).toBeNull()
  })

  it('пишет токен только в хранилище сессии', async () => {
    const { store, session, local } = createStore()

    await store.dispatch(login({ idInstance: '1100', apiTokenInstance: 'secret' }))

    expect(session.get(SESSION_KEY)).toContain('secret')
    expect(local.get(SESSION_KEY)).toBeNull()
    expect(local.get(chatsStorageKey('1100'))).not.toContain('secret')
  })
})

/**
 * Собирает store с памятью вместо браузерного storage.
 * @returns Store и оба хранилища сценария.
 */
function createStore() {
  const session = createMemoryStorage()
  const local = createMemoryStorage()
  const store = createAppStore({
    sender,
    queue,
    settings: {
      async enableIncomingQueue() {
        return undefined
      },
    },
    session,
    local,
  })

  return { store, session, local }
}
