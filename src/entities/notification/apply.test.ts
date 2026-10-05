import { describe, expect, it } from 'vitest'

import { applyNotification, type MailboxSnapshot } from './apply'

const emptySnapshot: MailboxSnapshot = { chats: [], messageIds: [] }
const chatId = '79876543210@c.us'
const knownPhoneChat = { chatId, phone: '79876543210' }

describe('applyNotification', () => {
  it('добавляет входящий текст в уже существующий чат', () => {
    const effect = applyNotification(incoming('m1', 'Привет'), {
      chats: [knownPhoneChat],
      messageIds: [],
    })

    expect(effect).toEqual({
      type: 'add-incoming',
      chatId,
      phone: '79876543210',
      telegramChatId: chatId,
      direction: 'in',
      createChat: false,
      message: { idMessage: 'm1', text: 'Привет', timestamp: 100 },
    })
  })

  it('создаёт отсутствующий чат для входящего текста', () => {
    const effect = applyNotification(incoming('m2', 'Новый'), emptySnapshot)

    expect(effect).toMatchObject({ type: 'add-incoming', createChat: true, chatId })
  })

  it('не добавляет второе сообщение с тем же idMessage', () => {
    const effect = applyNotification(incoming('m1', 'Привет'), {
      chats: [knownPhoneChat],
      messageIds: ['m1'],
    })

    expect(effect).toEqual({ type: 'ignore' })
  })

  it('помечает не-текст на удаление и не создаёт сообщение', () => {
    const effect = applyNotification(
      {
        typeWebhook: 'incomingMessageReceived',
        idMessage: 'file-1',
        timestamp: 100,
        senderData: { chatId },
        messageData: { typeMessage: 'imageMessage' },
      },
      emptySnapshot,
    )

    expect(effect).toEqual({ type: 'ignore' })
  })

  it('показывает исходящее уведомление как отправленное сообщение', () => {
    const effect = applyNotification(
      {
        typeWebhook: 'outgoingAPIMessageReceived',
        idMessage: 'out-1',
        timestamp: 100,
        senderData: { chatId },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Моё' } },
      },
      { chats: [knownPhoneChat], messageIds: [] },
    )

    expect(effect).toMatchObject({
      type: 'add-incoming',
      direction: 'out',
      chatId,
      createChat: false,
    })
  })

  it('кладёт ответ Telegram в чат, созданный по номеру телефона', () => {
    const effect = applyNotification(
      {
        typeWebhook: 'incomingMessageReceived',
        idMessage: 'tg-1',
        timestamp: 100,
        senderData: {
          chatId: '10000000',
          chatType: 'user',
          senderPhoneNumber: 79876543210,
        },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Ответ' } },
      },
      { chats: [knownPhoneChat], messageIds: [] },
    )

    expect(effect).toMatchObject({
      type: 'add-incoming',
      chatId,
      phone: '79876543210',
      telegramChatId: '10000000',
      createChat: false,
    })
  })

  it('игнорирует групповой чат', () => {
    const effect = applyNotification(
      {
        typeWebhook: 'incomingMessageReceived',
        idMessage: 'group-1',
        timestamp: 100,
        senderData: { chatId: '-100123', chatType: 'supergroup', senderPhoneNumber: 0 },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'В группе' } },
      },
      emptySnapshot,
    )

    expect(effect).toEqual({ type: 'ignore' })
  })

  it('поднимает лимит и не создаёт чат по quotaExceeded', () => {
    const effect = applyNotification({ typeWebhook: 'quotaExceeded' }, emptySnapshot)

    expect(effect).toEqual({ type: 'quota' })
  })

  it('игнорирует пустое тело, массив и уведомление без idMessage', () => {
    expect(applyNotification(null, emptySnapshot)).toEqual({ type: 'ignore' })
    expect(applyNotification([], emptySnapshot)).toEqual({ type: 'ignore' })
    expect(
      applyNotification(
        {
          typeWebhook: 'incomingMessageReceived',
          timestamp: 100,
          senderData: { chatId },
          messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Без id' } },
        },
        emptySnapshot,
      ),
    ).toEqual({ type: 'ignore' })
  })

  it('читает extendedTextMessage и исходящее из Telegram', () => {
    const extended = applyNotification(
      {
        typeWebhook: 'outgoingMessageReceived',
        idMessage: 'ext-1',
        senderData: { chatId },
        messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'Длинное' } },
      },
      { chats: [knownPhoneChat], messageIds: [] },
    )

    expect(extended).toMatchObject({
      type: 'add-incoming',
      direction: 'out',
      message: { idMessage: 'ext-1', text: 'Длинное', timestamp: 0 },
    })
  })

  it('игнорирует голос, стикер и канал', () => {
    expect(
      applyNotification(
        {
          typeWebhook: 'incomingMessageReceived',
          idMessage: 'voice-1',
          senderData: { chatId },
          messageData: { typeMessage: 'audioMessage' },
        },
        emptySnapshot,
      ),
    ).toEqual({ type: 'ignore' })

    expect(
      applyNotification(
        {
          typeWebhook: 'incomingMessageReceived',
          idMessage: 'channel-1',
          senderData: { chatId: '100', chatType: 'channel' },
          messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Канал' } },
        },
        emptySnapshot,
      ),
    ).toEqual({ type: 'ignore' })
  })

  it('не дублирует эхо API, пока локальный id ещё не подменён', () => {
    const effect = applyNotification(
      {
        typeWebhook: 'outgoingAPIMessageReceived',
        idMessage: 'server-1',
        timestamp: 100,
        senderData: { chatId },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
      },
      {
        chats: [knownPhoneChat],
        messageIds: ['local-1'],
        pendingOutgoing: [{ idMessage: 'local-1', chatId, text: 'Привет' }],
      },
    )

    expect(effect).toEqual({ type: 'ignore' })
  })

  it('кладёт скрытый номер в уже известный личный чат', () => {
    const effect = applyNotification(
      {
        typeWebhook: 'incomingMessageReceived',
        idMessage: 'hidden-known',
        timestamp: 100,
        senderData: { chatId: '10000000', senderPhoneNumber: 0 },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Снова' } },
      },
      {
        chats: [{ chatId, phone: '79876543210', telegramChatId: '10000000' }],
        messageIds: [],
      },
    )

    expect(effect).toMatchObject({
      type: 'add-incoming',
      chatId,
      createChat: false,
      message: { idMessage: 'hidden-known', text: 'Снова' },
    })
  })

  it('BUG-006: скрытый номер не создаёт chatId без @c.us', () => {
    const effect = applyNotification(
      {
        typeWebhook: 'incomingMessageReceived',
        idMessage: 'hidden-1',
        timestamp: 100,
        senderData: { chatId: '10000000', senderPhoneNumber: 0 },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Без номера' } },
      },
      emptySnapshot,
    )

    expect(effect).toEqual({ type: 'ignore' })
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
    senderData: { chatId },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
  }
}
