/**
 * Проверяет, что значение — обычный объект.
 * @param value Проверяемое значение.
 * @returns true, если это объект и не null.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
