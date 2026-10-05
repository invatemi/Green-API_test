import { describe, expect, it } from 'vitest'

import { createAppStore } from '@/app/store/createAppStore'
import { mailboxLoaded } from '@/entities/chat/chatsSlice'
import { sessionLoggedIn } from '@/entities/session/sessionSlice'
import type { MessageSender, NotificationQueue } from '@/shared/api/green-api'
import { createMemoryStorage } from '@/shared/lib/storage'

import { createChat } from './createChat'

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

describe('createChat', () => {
  it('собирает chatId из номера с плюсом и скобками и открывает чат', async () => {
    const store = createStore()
    signIn(store)

    const result = await store.dispatch(createChat('+7 (987) 654-32-10'))

    expect(createChat.fulfilled.match(result)).toBe(true)
    expect(store.getState().chats.chats[0]).toMatchObject({
      chatId: '79876543210@c.us',
      phone: '79876543210',
    })
    expect(store.getState().chats.activeChatId).toBe('79876543210@c.us')
  })

  it('повторный номер выбирает тот же чат и не плодит строку', async () => {
    const store = createStore()
    signIn(store)

    await store.dispatch(createChat('79876543210'))
    await store.dispatch(createChat('7 987 654 32 10'))

    expect(store.getState().chats.chats).toHaveLength(1)
    expect(store.getState().chats.activeChatId).toBe('79876543210@c.us')
  })

  it('без сессии не создаёт чат', async () => {
    const store = createStore()

    const result = await store.dispatch(createChat('79876543210'))

    expect(result.payload).toBe('Сначала войдите')
    expect(store.getState().chats.chats).toEqual([])
  })

  it('отклоняет короткий номер и буквы', async () => {
    const store = createStore()
    signIn(store)

    const short = await store.dispatch(createChat('12345'))
    const letters = await store.dispatch(createChat('телефон'))

    expect(short.payload).toBe('Номер должен содержать от 10 до 15 цифр')
    expect(letters.payload).toBe('Номер должен содержать только цифры')
    expect(store.getState().chats.chats).toEqual([])
  })
})

/**
 * Кладёт в store сессию, без которой чат не создаётся.
 * @param store Store сценария.
 */
function signIn(store: ReturnType<typeof createStore>): void {
  store.dispatch(sessionLoggedIn({ idInstance: '1100', apiTokenInstance: 'token' }))
  store.dispatch(mailboxLoaded({ idInstance: '1100', chats: [], messages: [], activeChatId: null }))
}

/**
 * Собирает store с памятью вместо браузерного storage.
 * @returns Store для сценария.
 */
function createStore() {
  return createAppStore({
    sender,
    queue,
    settings: {
      async enableIncomingQueue() {
        return undefined
      },
    },
    session: createMemoryStorage(),
    local: createMemoryStorage(),
  })
}
