import { describe, expect, it } from 'vitest'

import { resetLegacyStorage } from './reset'

const versionKey = 'green-api:storage-version'

describe('resetLegacyStorage', () => {
  it('стирает ключи прошлой версии и записывает текущую', () => {
    const session = createWebStorage()
    const local = createWebStorage()
    session.setItem('green-api:session', 'old-session')
    local.setItem('green-api:chats:1', 'old-chats')
    local.setItem('other-app', 'keep')

    resetLegacyStorage(session, local)

    expect(session.getItem('green-api:session')).toBeNull()
    expect(local.getItem('green-api:chats:1')).toBeNull()
    expect(local.getItem('other-app')).toBe('keep')
    expect(local.getItem(versionKey)).toBe('3')
  })

  it('повторный запуск не трогает уже перенесённые ключи', () => {
    const session = createWebStorage()
    const local = createWebStorage()
    resetLegacyStorage(session, local)
    local.setItem('green-api:chats:1', 'fresh')
    session.setItem('green-api:session', 'fresh-session')

    resetLegacyStorage(session, local)

    expect(local.getItem('green-api:chats:1')).toBe('fresh')
    expect(session.getItem('green-api:session')).toBe('fresh-session')
  })

  it('не стирает ключи чужого префикса при смене версии', () => {
    const session = createWebStorage()
    const local = createWebStorage()
    local.setItem('green-api:storage-version', '1')
    local.setItem('notes', 'keep')
    session.setItem('theme', 'dark')

    resetLegacyStorage(session, local)

    expect(local.getItem('notes')).toBe('keep')
    expect(session.getItem('theme')).toBe('dark')
    expect(local.getItem(versionKey)).toBe('3')
  })
})

/**
 * Собирает Storage в памяти.
 * @returns Пустое хранилище браузерного вида.
 */
function createWebStorage(): Storage {
  const entries = new Map<string, string>()

  return {
    get length() {
      return entries.size
    },
    clear() {
      entries.clear()
    },
    getItem(key: string) {
      return entries.get(key) ?? null
    },
    key(index: number) {
      return [...entries.keys()][index] ?? null
    },
    removeItem(key: string) {
      entries.delete(key)
    },
    setItem(key: string, value: string) {
      entries.set(key, value)
    },
  }
}
