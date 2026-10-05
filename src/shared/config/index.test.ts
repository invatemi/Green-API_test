import { afterEach, describe, expect, it, vi } from 'vitest'

import { getApiUrl } from './index'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getApiUrl', () => {
  it('возвращает хост без завершающего слэша', () => {
    vi.stubEnv('VITE_API_URL', 'https://4100.api.green-api.com/')

    expect(getApiUrl()).toBe('https://4100.api.green-api.com')
  })

  it('обрезает пробелы вокруг хоста', () => {
    vi.stubEnv('VITE_API_URL', '  https://4100.api.green-api.com  ')

    expect(getApiUrl()).toBe('https://4100.api.green-api.com')
  })

  it('падает, если хост не задан', () => {
    vi.stubEnv('VITE_API_URL', '   ')

    expect(() => getApiUrl()).toThrow('Не задан VITE_API_URL')
  })
})
