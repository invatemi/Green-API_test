const STORAGE_VERSION = '3'
const VERSION_KEY = 'green-api:storage-version'

/**
 * Один раз стирает сохранённые сессию и чаты прошлой версии store.
 * @param sessionStorage Хранилище вкладки.
 * @param localStorage Хранилище чатов.
 */
export function resetLegacyStorage(sessionStorage: Storage, localStorage: Storage): void {
  if (localStorage.getItem(VERSION_KEY) === STORAGE_VERSION) {
    return
  }

  clearPrefixed(sessionStorage)
  clearPrefixed(localStorage)
  localStorage.setItem(VERSION_KEY, STORAGE_VERSION)
}

/**
 * Удаляет все ключи мессенджера из хранилища.
 * @param storage Браузерное хранилище.
 */
function clearPrefixed(storage: Storage): void {
  const keys: string[] = []

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith('green-api:')) {
      keys.push(key)
    }
  }

  for (const key of keys) {
    storage.removeItem(key)
  }
}
