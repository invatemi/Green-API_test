/** Хранилище строковых пар, которое можно подменить в тестах. */
export interface KeyValueStorage {
  /**
   * Читает значение по ключу.
   * @param key Ключ записи.
   * @returns Строка или null, если ключа нет.
   */
  get(key: string): string | null

  /**
   * Записывает значение по ключу.
   * @param key Ключ записи.
   * @param value Сохраняемая строка.
   */
  set(key: string, value: string): void

  /**
   * Удаляет запись по ключу.
   * @param key Ключ записи.
   */
  remove(key: string): void
}

/**
 * Оборачивает браузерное Storage в общий интерфейс.
 * @param storage sessionStorage или localStorage.
 * @returns Адаптер KeyValueStorage.
 */
export function webStorage(storage: Storage): KeyValueStorage {
  return {
    get(key) {
      return storage.getItem(key)
    },
    set(key, value) {
      storage.setItem(key, value)
    },
    remove(key) {
      storage.removeItem(key)
    },
  }
}

/**
 * Создаёт хранилище в памяти для тестов.
 * @returns Пустое KeyValueStorage.
 */
export function createMemoryStorage(): KeyValueStorage {
  const entries = new Map<string, string>()

  return {
    get(key) {
      return entries.get(key) ?? null
    },
    set(key, value) {
      entries.set(key, value)
    },
    remove(key) {
      entries.delete(key)
    },
  }
}
