import { describe, expect, it } from 'vitest'

import { createMemoryStorage } from '@/shared/lib/storage'

import { emptyMailbox } from '../chat/model'
import type { MessengerState } from '../state'
import { chatsStorageKey, persistSnapshot, readInitialState, readMailbox, SESSION_KEY } from './persist'

describe('persistSnapshot', () => {
  it('пишет токен только в хранилище сессии', () => {
    const session = createMemoryStorage()
    const local = createMemoryStorage()

    persistSnapshot(stateFor('4100', 'secret-token'), session, local)

    expect(session.get(SESSION_KEY)).toContain('secret-token')
    expect(local.get(SESSION_KEY)).toBeNull()
    expect(local.get(chatsStorageKey('4100'))).not.toContain('secret-token')
  })

  it('хранит ящики разных idInstance отдельно', () => {
    const session = createMemoryStorage()
    const local = createMemoryStorage()

    persistSnapshot(stateFor('111', 'token-a', '79990001122@c.us'), session, local)
    persistSnapshot(stateFor('222', 'token-b'), session, local)

    expect(readMailbox(local, '111').chats.map((chat) => chat.chatId)).toEqual(['79990001122@c.us'])
    expect(readMailbox(local, '111').activeChatId).toBe('79990001122@c.us')
    expect(readMailbox(local, '222').chats).toEqual([])
  })

  it('при выходе удаляет сессию и оставляет чаты', () => {
    const session = createMemoryStorage()
    const local = createMemoryStorage()
    persistSnapshot(stateFor('111', 'token-a', '79990001122@c.us'), session, local)

    persistSnapshot(
      {
        session: { credentials: null, quotaExceeded: false },
        chats: { idInstance: null, ...emptyMailbox() },
      },
      session,
      local,
    )

    expect(session.get(SESSION_KEY)).toBeNull()
    expect(readInitialState(session, local).session.credentials).toBeNull()
    expect(readMailbox(local, '111').chats).toHaveLength(1)
  })

  it('поднимает сохранённый флаг лимита и отбрасывает битый JSON', () => {
    const session = createMemoryStorage()
    const local = createMemoryStorage()
    const saved = stateFor('4100', 'token')
    saved.session.quotaExceeded = true
    persistSnapshot(saved, session, local)
    local.set(chatsStorageKey('4100'), '{')

    const restored = readInitialState(session, local)

    expect(restored.session.quotaExceeded).toBe(true)
    expect(restored.chats.chats).toEqual([])
    expect(restored.chats.messages).toEqual([])
  })

  it('пустую и не-JSON сессию читает как выход', () => {
    const session = createMemoryStorage()
    const local = createMemoryStorage()
    session.set(SESSION_KEY, 'not-json')

    expect(readInitialState(session, local).session.credentials).toBeNull()

    session.set(SESSION_KEY, JSON.stringify({ credentials: { idInstance: 1 } }))
    expect(readInitialState(session, local).session.credentials).toBeNull()
  })

  it('BUG-004: pending после перезагрузки не остаётся вечной отправкой', () => {
    const session = createMemoryStorage()
    const local = createMemoryStorage()
    const state = stateFor('4100', 'token', '79876543210@c.us')
    state.chats.messages = [
      {
        idMessage: 'local-1',
        chatId: '79876543210@c.us',
        direction: 'out',
        text: 'Привет',
        timestamp: 1,
        status: 'pending',
        read: true,
      },
    ]
    persistSnapshot(state, session, local)

    expect(readInitialState(session, local).chats.messages[0]?.status).not.toBe('pending')
  })

  it('BUG-008: битый activeChatId не открывает пустую переписку', () => {
    const session = createMemoryStorage()
    const local = createMemoryStorage()
    const state = stateFor('4100', 'token')
    state.chats.activeChatId = 'ghost@c.us'
    persistSnapshot(state, session, local)

    expect(readInitialState(session, local).chats.activeChatId).toBeNull()
  })
})

/**
 * Собирает состояние одного инстанса.
 * @param idInstance Идентификатор инстанса.
 * @param token Токен инстанса.
 * @param chatId Необязательный чат в ящике.
 * @returns Состояние для записи.
 */
function stateFor(idInstance: string, token: string, chatId?: string): MessengerState {
  return {
    session: {
      credentials: { idInstance, apiTokenInstance: token },
      quotaExceeded: false,
    },
    chats: {
      idInstance,
      chats: chatId ? [{ chatId, phone: chatId.replace('@c.us', ''), updatedAt: 1 }] : [],
      messages: [],
      activeChatId: chatId ?? null,
    },
  }
}
