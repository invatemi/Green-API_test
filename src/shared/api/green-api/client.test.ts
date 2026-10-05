import { afterEach, describe, expect, it, vi } from 'vitest'

import { GreenApiClient } from './client'
import { ApiError, QuotaExceededError } from './errors'

const credentials = { idInstance: '1100', apiTokenInstance: 'token' }
const client = new GreenApiClient('https://example.test')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GreenApiClient', () => {
  it('отправляет текст на URL SendMessage и возвращает idMessage', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ idMessage: 'abc' }))

    await expect(client.sendText(credentials, '79876543210@c.us', 'Привет')).resolves.toEqual({
      idMessage: 'abc',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/waInstance1100/sendMessage/token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ chatId: '79876543210@c.us', message: 'Привет' }),
      }),
    )
  })

  it('превращает статус 466 в ошибку лимита чатов', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'limit' }, 466))

    await expect(client.sendText(credentials, '79876543210@c.us', 'Привет')).rejects.toBeInstanceOf(
      QuotaExceededError,
    )
  })

  it('отличает пустую очередь от уведомления с receiptId', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse({ receiptId: 7, body: { typeWebhook: 'incomingMessageReceived' } }))

    await expect(client.receiveNotification(credentials)).resolves.toBeNull()
    await expect(client.receiveNotification(credentials)).resolves.toEqual({
      receiptId: 7,
      body: { typeWebhook: 'incomingMessageReceived' },
    })
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://example.test/waInstance1100/receiveNotification/token?receiveTimeout=5',
    )
  })

  it('включает очередь входящих и исходящих, не отправляя служебные поля', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          wid: '79990001122@c.us',
          typeInstance: 'telegram',
          incomingWebhook: 'no',
          delaySendMessagesMilliseconds: 500,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ saveSettings: true }))

    await client.enableIncomingQueue(credentials)

    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1] && (fetchMock.mock.calls[1][1] as RequestInit).body))
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://example.test/waInstance1100/setSettings/token')
    expect(body).toMatchObject({
      incomingWebhook: 'yes',
      outgoingMessageWebhook: 'yes',
      outgoingAPIMessageWebhook: 'yes',
      delaySendMessagesMilliseconds: 500,
    })
    expect(body).not.toHaveProperty('wid')
    expect(body).not.toHaveProperty('typeInstance')
  })

  it('удаляет уведомление запросом DELETE с receiptId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ result: true }))

    await client.deleteNotification(credentials, 7)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/waInstance1100/deleteNotification/token/7',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('кодирует id и токен в пути и убирает слэш у хоста', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ idMessage: 15 }))
    const trimmed = new GreenApiClient('https://example.test/')

    await expect(
      trimmed.sendText({ idInstance: '11/00', apiTokenInstance: 'a+b' }, '79876543210@c.us', 'Привет'),
    ).resolves.toEqual({ idMessage: '15' })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/waInstance11%2F00/sendMessage/a%2Bb')
  })

  it('бросает ApiError, если в успешном ответе нет idMessage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }))

    await expect(client.sendText(credentials, '79876543210@c.us', 'Привет')).rejects.toBeInstanceOf(ApiError)
  })

  it('пробрасывает текст ошибки 401 и не считает его лимитом чатов', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'Инстанс не авторизован' }, 401))

    await expect(client.sendText(credentials, '79876543210@c.us', 'Привет')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Инстанс не авторизован',
    })
  })

  it('не считает лимитом успешный ответ, где слово quotaExceeded упомянуто в другом поле', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ idMessage: 'abc', note: 'quotaExceeded' }),
    )

    await expect(client.sendText(credentials, '79876543210@c.us', 'Привет')).resolves.toEqual({
      idMessage: 'abc',
    })
  })

  it('возвращает null для уведомления без числового receiptId и падает на ошибке удаления', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ receiptId: '7', body: {} }))
      .mockResolvedValueOnce(jsonResponse({ message: 'gone' }, 404))

    await expect(client.receiveNotification(credentials)).resolves.toBeNull()
    await expect(client.deleteNotification(credentials, 7)).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('не записывает настройки, если входящая и исходящая очереди уже включены', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        incomingWebhook: 'yes',
        outgoingMessageWebhook: 'yes',
        outgoingAPIMessageWebhook: 'yes',
        wid: '79990001122@c.us',
      }),
    )

    await client.enableIncomingQueue(credentials)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/getSettings/')
  })

  it('падает, если настройки инстанса не прочитались', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(null, 500))

    await expect(client.enableIncomingQueue(credentials)).rejects.toBeInstanceOf(ApiError)
  })
})

/**
 * Собирает JSON-ответ fetch.
 * @param payload Тело ответа.
 * @param status Код ответа.
 * @returns Response с текстом JSON.
 */
function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
