import { describe, expect, it, vi } from 'vitest'

import { ApiError, QuotaExceededError, type MessageSender, type NotificationQueue } from '@/shared/api/green-api'
import { createMemoryStorage } from '@/shared/lib/storage'
import { MESSAGE_MAX_LENGTH } from '@/shared/lib/text'
import { createAppStore } from '@/app/store/createAppStore'
import { mailboxLoaded } from '@/entities/chat/chatsSlice'
import { sessionLoggedIn } from '@/entities/session/sessionSlice'

import { sendMessage } from './sendMessage'

const queue: NotificationQueue = {
  async receiveNotification() {
    return null
  },
  async deleteNotification() {
    return undefined
  },
}

const settings = {
  async enableIncomingQueue() {
    return undefined
  },
}

describe('sendMessage', () => {
  it('переводит pending в sent и записывает idMessage', async () => {
    const sender: MessageSender = {
      async sendText() {
        return { idMessage: 'server-1' }
      },
    }
    const store = createStore(sender)
    signIn(store)

    await store.dispatch(sendMessage({ chatId: '79876543210@c.us', text: 'Привет' }))

    expect(store.getState().chats.messages[0]).toMatchObject({
      idMessage: 'server-1',
      status: 'sent',
      text: 'Привет',
    })
  })

  it('при ошибке лимита ставит failed и включает баннер', async () => {
    const sender: MessageSender = {
      async sendText() {
        throw new QuotaExceededError()
      },
    }
    const store = createStore(sender)
    signIn(store)

    const result = await store.dispatch(sendMessage({ chatId: '79876543210@c.us', text: 'Привет' }))

    expect(result.payload).toMatchObject({ quota: true, skipped: false })
    expect(store.getState().chats.messages[0]?.status).toBe('failed')
    expect(store.getState().session.quotaExceeded).toBe(true)
  })

  it('не вызывает порт, если текст длиннее 4096 символов', async () => {
    const sendText = vi.fn(async () => ({ idMessage: 'unused' }))
    const store = createStore({ sendText })

    const result = await store.dispatch(
      sendMessage({ chatId: '79876543210@c.us', text: 'а'.repeat(MESSAGE_MAX_LENGTH + 1) }),
    )

    expect(sendText).not.toHaveBeenCalled()
    expect(result.payload).toMatchObject({ skipped: true, quota: false })
    expect(store.getState().chats.messages).toEqual([])
  })

  it('отправляет текст ровно из 4096 символов', async () => {
    const sendText = vi.fn(async () => ({ idMessage: 'limit-1' }))
    const store = createStore({ sendText })
    signIn(store)
    const text = 'а'.repeat(MESSAGE_MAX_LENGTH)

    await store.dispatch(sendMessage({ chatId: '79876543210@c.us', text }))

    expect(sendText).toHaveBeenCalledOnce()
    expect(store.getState().chats.messages[0]).toMatchObject({ idMessage: 'limit-1', text, status: 'sent' })
  })

  it('не вызывает порт для пустого текста и текста из пробелов', async () => {
    const sendText = vi.fn(async () => ({ idMessage: 'unused' }))
    const store = createStore({ sendText })
    signIn(store)

    const empty = await store.dispatch(sendMessage({ chatId: '79876543210@c.us', text: '' }))
    const spaces = await store.dispatch(sendMessage({ chatId: '79876543210@c.us', text: '   ' }))

    expect(sendText).not.toHaveBeenCalled()
    expect(empty.payload).toMatchObject({ skipped: true, reason: 'Введите текст сообщения' })
    expect(spaces.payload).toMatchObject({ skipped: true, reason: 'Введите текст сообщения' })
    expect(store.getState().chats.messages).toEqual([])
  })

  it('обрезает крайние пробелы и отправляет текст', async () => {
    const sendText = vi.fn(async () => ({ idMessage: 'trim-1' }))
    const store = createStore({ sendText })
    signIn(store)

    await store.dispatch(sendMessage({ chatId: '79876543210@c.us', text: '  Привет  ' }))

    expect(sendText).toHaveBeenCalledWith(
      { idInstance: '1100', apiTokenInstance: 'token' },
      '79876543210@c.us',
      'Привет',
    )
  })

  it('не отправляет сообщение без сессии', async () => {
    const sendText = vi.fn(async () => ({ idMessage: 'unused' }))
    const store = createStore({ sendText })

    const result = await store.dispatch(sendMessage({ chatId: '79876543210@c.us', text: 'Привет' }))

    expect(sendText).not.toHaveBeenCalled()
    expect(result.payload).toMatchObject({ skipped: true, reason: 'Сначала войдите' })
    expect(store.getState().chats.messages).toEqual([])
  })

  it('помечает сообщение failed при сетевой ошибке и не поднимает лимит', async () => {
    const store = createStore({
      async sendText() {
        throw new Error('network')
      },
    })
    signIn(store)

    const result = await store.dispatch(sendMessage({ chatId: '79876543210@c.us', text: 'Привет' }))

    expect(result.payload).toMatchObject({
      skipped: false,
      quota: false,
      reason: 'Не удалось отправить сообщение',
    })
    expect(store.getState().chats.messages[0]?.status).toBe('failed')
    expect(store.getState().session.quotaExceeded).toBe(false)
  })

  it('BUG-007: текст ApiError доходит до причины отказа', async () => {
    const store = createStore({
      async sendText() {
        throw new ApiError('Инстанс не авторизован', 401)
      },
    })
    signIn(store)

    const result = await store.dispatch(sendMessage({ chatId: '79876543210@c.us', text: 'Привет' }))

    expect(result.payload).toMatchObject({ reason: 'Инстанс не авторизован', quota: false })
  })
})

/**
 * Кладёт в store сессию, без которой отправка не вызывает порт.
 * @param store Store сценария.
 */
function signIn(store: ReturnType<typeof createStore>): void {
  store.dispatch(sessionLoggedIn({ idInstance: '1100', apiTokenInstance: 'token' }))
  store.dispatch(mailboxLoaded({ idInstance: '1100', chats: [], messages: [], activeChatId: null }))
}

/**
 * Собирает store с памятью вместо браузерного storage.
 * @param sender Подменённый порт отправки.
 * @returns Store для сценария.
 */
function createStore(sender: MessageSender) {
  return createAppStore({
    sender,
    queue,
    settings,
    session: createMemoryStorage(),
    local: createMemoryStorage(),
  })
}
