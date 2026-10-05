/**
 * Возвращает хост GREEN-API из окружения Vite.
 * @returns Базовый URL без завершающего слэша.
 */
export function getApiUrl(): string {
  const url = import.meta.env.VITE_API_URL?.trim()

  if (!url) {
    throw new Error('Не задан VITE_API_URL')
  }

  return url.replace(/\/$/, '')
}
