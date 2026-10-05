import { describe, expect, it, vi } from 'vitest'

import { createAppStore } from '@/app/store/createAppStore'
import { mailboxCleared, mailboxLoaded } from '@/entities/chat/chatsSlice'
import { sessionLoggedIn, sessionLoggedOut } from '@/entities/session/sessionSlice'
import {
  QuotaExceededError,
  type MessageSender,
  type NotificationQueue,
  type QueuedNotification,
} from '@/shared/api/green-api'
import { createMemoryStorage } from '@/shared/lib/storage'

import { sendMessage } from '../send-message/sendMessage'
import { receiveNext } from './receiveNext'

const sender: MessageSender = {
  async sendText() {
    return { idMessage: 'unused' }
  },
}

describe('receiveNext', () => {
  it('без сессии не трогает очередь', async () => {
    const receiveNotification = vi.fn(async () => null)
    const { store } = createStore('recv-none', { receiveNotification, deleteNotification: vi.fn() }, false)

    await store.dispatch(receiveNext())

    expect(receiveNotification).not.toHaveBeenCalled()
  })

  it('кладёт входящий текст в новый чат и удаляет квитанцию', async () => {
    const deleteNotification = vi.fn(async () => undefined)
    const { store } = createStore('recv-in', {
      async receiveNotification() {
        return {
          receiptId: 4,
          body: incoming('in-1', 'Привет'),
        }
      },
      deleteNotification,
    })

    await store.dispatch(receiveNext())

    expect(store.getState().chats.messages[0]).toMatchObject({
      idMessage: 'in-1',
      text: 'Привет',
      direction: 'in',
      chatId: '79876543210@c.us',
    })
    expect(store.getState().chats.chats).toHaveLength(1)
    expect(deleteNotification).toHaveBeenCalledWith(
      { idInstance: 'recv-in', apiTokenInstance: 'token' },
      4,
      expect.anything(),
    )
  })

  it('удаляет нетекстовое уведомление и не создаёт сообщение', async () => {
    const deleteNotification = vi.fn(async () => undefined)
    const { store } = createStore('recv-file', {
      async receiveNotification() {
        return {
          receiptId: 8,
          body: {
            typeWebhook: 'incomingMessageReceived',
            idMessage: 'file-1',
            senderData: { chatId: '79876543210@c.us' },
            messageData: { typeMessage: 'imageMessage' },
          },
        }
      },
      deleteNotification,
    })

    await store.dispatch(receiveNext())

    expect(store.getState().chats.messages).toEqual([])
    expect(deleteNotification).toHaveBeenCalledOnce()
  })

  it('по уведомлению quotaExceeded поднимает баннер и удаляет квитанцию', async () => {
    const deleteNotification = vi.fn(async () => undefined)
    const { store } = createStore('recv-quota', {
      async receiveNotification() {
        return { receiptId: 3, body: { typeWebhook: 'quotaExceeded' } }
      },
      deleteNotification,
    })

    await store.dispatch(receiveNext())

    expect(store.getState().session.quotaExceeded).toBe(true)
    expect(store.getState().chats.chats).toEqual([])
    expect(deleteNotification).toHaveBeenCalledOnce()
  })

  it('не включает очередь повторно для того же инстанса', async () => {
    const { store, enableIncomingQueue } = createStore('recv-ready', {
      async receiveNotification() {
        return null
      },
      async deleteNotification() {
        return undefined
      },
    })

    await store.dispatch(receiveNext())
    await store.dispatch(receiveNext())

    expect(enableIncomingQueue).toHaveBeenCalledTimes(1)
  })

  it('не удаляет квитанцию, если запрос уведомления упал', async () => {
    const deleteNotification = vi.fn(async () => undefined)
    const { store } = createStore('recv-net', {
      async receiveNotification() {
        throw new Error('network')
      },
      deleteNotification,
    })

    const result = await store.dispatch(receiveNext())

    expect(receiveNext.rejected.match(result)).toBe(true)
    expect(deleteNotification).not.toHaveBeenCalled()
    expect(store.getState().chats.messages).toEqual([])
  })

  it('BUG-001: эхо исходящего до подмены idMessage не создаёт второй пузырь', async () => {
    let releaseSend: (value: { idMessage: string }) => void = () => {}
    const sendText = vi.fn(
      () =>
        new Promise<{ idMessage: string }>((resolve) => {
          releaseSend = resolve
        }),
    )
    let releaseNote: (value: QueuedNotification | null) => void = () => {}
    const receiveNotification = vi.fn(
      () =>
        new Promise<QueuedNotification | null>((resolve) => {
          releaseNote = resolve
        }),
    )
    const { store } = createStore(
      'recv-dup',
      {
        receiveNotification,
        async deleteNotification() {
          return undefined
        },
      },
      true,
      { sendText },
    )
    const chatId = '79876543210@c.us'

    const sending = store.dispatch(sendMessage({ chatId, text: 'Привет' }))
    await vi.waitFor(() => {
      expect(sendText).toHaveBeenCalled()
    })
    const receiving = store.dispatch(receiveNext())
    await vi.waitFor(() => {
      expect(receiveNotification).toHaveBeenCalled()
    })
    releaseNote({
      receiptId: 1,
      body: {
        typeWebhook: 'outgoingAPIMessageReceived',
        idMessage: 'server-1',
        timestamp: 100,
        senderData: { chatId },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
      },
    })
    await receiving
    releaseSend({ idMessage: 'server-1' })
    await sending

    expect(store.getState().chats.messages).toHaveLength(1)
    expect(store.getState().chats.messages[0]).toMatchObject({ idMessage: 'server-1', status: 'sent', text: 'Привет' })
  })

  it('BUG-002: уведомление не приклеивается к чужому инстансу и не удаляется из его очереди', async () => {
    let release: ((value: QueuedNotification | null) => void) | undefined
    const deleteNotification = vi.fn(async () => undefined)
    const { store } = createStore('recv-a', {
      receiveNotification: () =>
        new Promise((resolve) => {
          release = resolve
        }),
      deleteNotification,
    })
    const pending = store.dispatch(receiveNext())
    await vi.waitFor(() => {
      expect(release).toBeTypeOf('function')
    })

    store.dispatch(sessionLoggedOut())
    store.dispatch(mailboxCleared())
    store.dispatch(sessionLoggedIn({ idInstance: 'recv-b', apiTokenInstance: 'token-b' }))
    store.dispatch(mailboxLoaded({ idInstance: 'recv-b', chats: [], messages: [], activeChatId: null }))
    release?.({ receiptId: 9, body: incoming('from-a', 'Чужое') })
    await pending

    expect({
      idInstance: store.getState().chats.idInstance,
      messages: store.getState().chats.messages.map((message) => message.text),
      deleted: deleteNotification.mock.calls.length,
    }).toEqual({ idInstance: 'recv-b', messages: [], deleted: 0 })
  })

  it('BUG-003: ошибка 466 на опросе очереди включает баннер лимита', async () => {
    const { store } = createStore('recv-466', {
      async receiveNotification() {
        throw new QuotaExceededError()
      },
      async deleteNotification() {
        return undefined
      },
    })

    await store.dispatch(receiveNext())

    expect(store.getState().session.quotaExceeded).toBe(true)
  })
})

/**
 * Собирает тело входящего текста.
 * @param idMessage Идентификатор сообщения.
 * @param text Текст.
 * @returns Тело уведомления incomingMessageReceived.
 */
function incoming(idMessage: string, text: string) {
  return {
    typeWebhook: 'incomingMessageReceived',
    idMessage,
    timestamp: 100,
    senderData: { chatId: '79876543210@c.us' },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
  }
}

/**
 * Собирает store с памятью и подменённой очередью.
 * @param idInstance Идентификатор инстанса. У каждого теста свой, чтобы не делить флаг готовности очереди.
 * @param queue Порт очереди.
 * @param signedIn Входить ли в сессию перед сценарием.
 * @param sender Порт отправки.
 * @returns Store и шпион включения очереди.
 */
function createStore(
  idInstance: string,
  queue: Partial<NotificationQueue>,
  signedIn = true,
  senderOverride?: MessageSender,
) {
  const enableIncomingQueue = vi.fn(async () => undefined)
  const store = createAppStore({
    sender: senderOverride ?? sender,
    queue: {
      async receiveNotification() {
        return null
      },
      async deleteNotification() {
        return undefined
      },
      ...queue,
    },
    settings: { enableIncomingQueue },
    session: createMemoryStorage(),
    local: createMemoryStorage(),
  })

  if (signedIn) {
    store.dispatch(sessionLoggedIn({ idInstance, apiTokenInstance: 'token' }))
    store.dispatch(mailboxLoaded({ idInstance, chats: [], messages: [], activeChatId: null }))
  }

  return { store, enableIncomingQueue }
}
