import { describe, expect, it } from 'vitest'

import { notificationApplied } from '../notification/actions'
import {
  activeChatCleared,
  chatSelected,
  chatUpserted,
  chatsReducer,
  mailboxLoaded,
  outgoingAdded,
  outgoingFailed,
  outgoingResolved,
  selectActiveMessages,
  selectChatRows,
} from './chatsSlice'

describe('chatsSlice', () => {
  it('не смешивает ящики двух idInstance', () => {
    const first = chatsReducer(
      undefined,
      mailboxLoaded({
        idInstance: 'a',
        chats: [{ chatId: '79990001122@c.us', phone: '79990001122', updatedAt: 1 }],
        messages: [],
        activeChatId: '79990001122@c.us',
      }),
    )

    const second = chatsReducer(
      first,
      mailboxLoaded({
        idInstance: 'b',
        chats: [],
        messages: [],
        activeChatId: null,
      }),
    )

    expect(second.idInstance).toBe('b')
    expect(second.chats).toEqual([])
  })

  it('не плодит строку при повторном создании того же chatId', () => {
    const created = chatsReducer(
      undefined,
      chatUpserted({ chatId: '79990001122@c.us', phone: '79990001122', updatedAt: 1 }),
    )
    const repeated = chatsReducer(
      created,
      chatUpserted({ chatId: '79990001122@c.us', phone: '79990001122', updatedAt: 2 }),
    )

    expect(repeated.chats).toHaveLength(1)
    expect(repeated.activeChatId).toBe('79990001122@c.us')
    expect(repeated.chats[0]?.updatedAt).toBe(2)
  })

  it('находит сообщение по idMessage и меняет статус', () => {
    const withMessage = chatsReducer(
      undefined,
      outgoingAdded({
        idMessage: 'local-1',
        chatId: '79990001122@c.us',
        direction: 'out',
        text: 'Привет',
        timestamp: 1,
        status: 'pending',
        read: true,
      }),
    )
    const resolved = chatsReducer(withMessage, outgoingResolved({ localId: 'local-1', idMessage: 'server-1' }))

    expect(resolved.messages[0]).toMatchObject({ idMessage: 'server-1', status: 'sent' })
  })

  it('помечает исходящее как failed и не трогает чужое сообщение', () => {
    const withMessage = chatsReducer(
      undefined,
      outgoingAdded({
        idMessage: 'local-1',
        chatId: '79990001122@c.us',
        direction: 'out',
        text: 'Привет',
        timestamp: 1,
        status: 'pending',
        read: true,
      }),
    )
    const failed = chatsReducer(withMessage, outgoingFailed({ localId: 'missing' }))
    const marked = chatsReducer(failed, outgoingFailed({ localId: 'local-1' }))

    expect(failed.messages[0]?.status).toBe('pending')
    expect(marked.messages[0]?.status).toBe('failed')
  })

  it('оставляет открытым текущий чат и помечает чужое входящее непрочитанным', () => {
    const opened = chatsReducer(
      undefined,
      chatUpserted({ chatId: '79990001122@c.us', phone: '79990001122', updatedAt: 1 }),
    )
    const withIncoming = chatsReducer(
      opened,
      notificationApplied({
        type: 'add-incoming',
        chatId: '79876543210@c.us',
        phone: '79876543210',
        telegramChatId: '100',
        direction: 'in',
        createChat: true,
        message: { idMessage: 'in-1', text: 'Ответ', timestamp: 2 },
      }),
    )

    expect(withIncoming.activeChatId).toBe('79990001122@c.us')
    expect(withIncoming.messages[0]).toMatchObject({ read: false, chatId: '79876543210@c.us' })
    expect(selectActiveMessages({ chats: withIncoming })).toEqual([])

    const selected = chatsReducer(withIncoming, chatSelected('79876543210@c.us'))
    expect(selected.messages[0]?.read).toBe(true)
    expect(selectActiveMessages({ chats: selected })).toHaveLength(1)
  })

  it('не добавляет второе входящее с тем же idMessage и сбрасывает выбор', () => {
    const first = chatsReducer(
      undefined,
      notificationApplied({
        type: 'add-incoming',
        chatId: '79876543210@c.us',
        phone: '79876543210',
        telegramChatId: '79876543210@c.us',
        direction: 'in',
        createChat: true,
        message: { idMessage: 'in-1', text: 'Раз', timestamp: 2 },
      }),
    )
    const second = chatsReducer(
      first,
      notificationApplied({
        type: 'add-incoming',
        chatId: '79876543210@c.us',
        phone: '79876543210',
        telegramChatId: '79876543210@c.us',
        direction: 'in',
        createChat: false,
        message: { idMessage: 'in-1', text: 'Раз', timestamp: 3 },
      }),
    )
    const cleared = chatsReducer(second, activeChatCleared())

    expect(second.messages).toHaveLength(1)
    expect(cleared.activeChatId).toBeNull()
  })

  it('BUG-005: первое входящее в пустом ящике считается прочитанным', () => {
    const state = chatsReducer(
      undefined,
      notificationApplied({
        type: 'add-incoming',
        chatId: '79876543210@c.us',
        phone: '79876543210',
        telegramChatId: '79876543210@c.us',
        direction: 'in',
        createChat: true,
        message: { idMessage: 'in-1', text: 'Привет', timestamp: 2 },
      }),
    )

    expect(state.activeChatId).toBe('79876543210@c.us')
    expect(state.messages[0]?.read).toBe(true)
  })

  it('собирает превью, непрочитанные и активный чат', () => {
    const state = chatsReducer(
      undefined,
      mailboxLoaded({
        idInstance: 'a',
        activeChatId: '79990001122@c.us',
        chats: [
          { chatId: '79990001122@c.us', phone: '79990001122', updatedAt: 1 },
          { chatId: '79876543210@c.us', phone: '79876543210', updatedAt: 2 },
        ],
        messages: [
          message('1', '79876543210@c.us', 'in', 'Первое', true),
          message('2', '79876543210@c.us', 'out', 'Ответ', true),
          message('3', '79876543210@c.us', 'in', 'Ещё', false),
        ],
      }),
    )

    expect(selectChatRows({ chats: state })).toEqual([
      {
        chatId: '79990001122@c.us',
        phone: '79990001122',
        preview: 'Нет сообщений',
        unread: 0,
        active: true,
      },
      {
        chatId: '79876543210@c.us',
        phone: '79876543210',
        preview: 'Ещё',
        unread: 1,
        active: false,
      },
    ])
  })

  it('не считает прочитанные входящие и исходящие непрочитанными', () => {
    const state = chatsReducer(
      undefined,
      mailboxLoaded({
        idInstance: 'a',
        activeChatId: null,
        chats: [{ chatId: '79990001122@c.us', phone: '79990001122', updatedAt: 1 }],
        messages: [
          message('1', '79990001122@c.us', 'in', 'Прочитано', true),
          message('2', '79990001122@c.us', 'out', 'Исходящее', true),
        ],
      }),
    )

    expect(selectChatRows({ chats: state })[0]).toMatchObject({ preview: 'Исходящее', unread: 0, active: false })
  })

  it('возвращает те же строки, пока лента и выбор не изменились', () => {
    const view = {
      chats: chatsReducer(
        undefined,
        mailboxLoaded({
          idInstance: 'a',
          activeChatId: null,
          chats: [{ chatId: '79990001122@c.us', phone: '79990001122', updatedAt: 1 }],
          messages: [],
        }),
      ),
    }
    const rows = selectChatRows(view)

    expect(selectChatRows(view)).toBe(rows)
  })
})

/**
 * Собирает сообщение для селектора строк.
 * @param idMessage Идентификатор сообщения.
 * @param chatId Идентификатор чата.
 * @param direction Направление.
 * @param text Текст.
 * @param read Признак прочтения.
 * @returns Сообщение ленты.
 */
function message(
  idMessage: string,
  chatId: string,
  direction: 'in' | 'out',
  text: string,
  read: boolean,
) {
  return {
    idMessage,
    chatId,
    direction,
    text,
    timestamp: 1,
    status: 'sent' as const,
    read,
  }
}
