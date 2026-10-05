import { isRecord } from '@/shared/lib'

import { ApiError, QuotaExceededError } from './errors'
import type {
  Credentials,
  InstanceSettings,
  MessageSender,
  NotificationQueue,
  QueuedNotification,
  SentMessage,
} from './types'

const RECEIVE_TIMEOUT_SECONDS = 5

/**
 * HTTP-клиент методов SendMessage, receiveNotification и deleteNotification.
 */
export class GreenApiClient implements MessageSender, NotificationQueue, InstanceSettings {
  private readonly apiUrl: string

  /**
   * Сохраняет хост инстанса.
   * @param apiUrl Базовый URL без завершающего слэша.
   */
  constructor(apiUrl: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '')
  }

  /**
   * Отправляет текст методом SendMessage.
   * @param credentials Учётные данные инстанса.
   * @param chatId Идентификатор чата.
   * @param message Текст сообщения.
   * @returns Идентификатор отправленного сообщения.
   */
  async sendText(credentials: Credentials, chatId: string, message: string): Promise<SentMessage> {
    const response = await fetch(this.methodUrl(credentials, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    })
    const payload = await readPayload(response)
    assertNotQuota(response, payload)

    if (!response.ok) {
      throw new ApiError(errorText(payload, 'Не удалось отправить сообщение'), response.status)
    }

    const idMessage = readIdMessage(payload)
    if (!idMessage) {
      throw new ApiError(errorText(payload, 'Ответ отправки не содержит idMessage'), response.status)
    }

    return { idMessage }
  }

  /**
   * Ждёт одно уведомление из очереди.
   * @param credentials Учётные данные инстанса.
   * @param signal Сигнал отмены долгого запроса.
   * @returns Уведомление или null, если очередь пуста.
   */
  async receiveNotification(
    credentials: Credentials,
    signal?: AbortSignal,
  ): Promise<QueuedNotification | null> {
    const url = new URL(this.methodUrl(credentials, 'receiveNotification'))
    url.searchParams.set('receiveTimeout', String(RECEIVE_TIMEOUT_SECONDS))

    const response = await fetch(url, { signal })
    const payload = await readPayload(response)
    assertNotQuota(response, payload)

    if (!response.ok) {
      throw new ApiError('Не удалось получить уведомление', response.status)
    }

    if (payload === null) {
      return null
    }

    if (!isRecord(payload) || typeof payload.receiptId !== 'number') {
      return null
    }

    return { receiptId: payload.receiptId, body: payload.body }
  }

  /**
   * Включает incomingWebhook. Без этого очередь входящих остаётся пустой.
   * @param credentials Учётные данные инстанса.
   */
  async enableIncomingQueue(credentials: Credentials): Promise<void> {
    const current = await this.readSettings(credentials)

    if (
      current.incomingWebhook === 'yes' &&
      current.outgoingMessageWebhook === 'yes' &&
      current.outgoingAPIMessageWebhook === 'yes'
    ) {
      return
    }

    // Spread Record<string, unknown> теряет индексную сигнатуру и оставляет только webhookUrl.
    const next: Record<string, unknown> = { ...current, webhookUrl: '' }
    delete next.wid
    delete next.typeInstance
    next.incomingWebhook = 'yes'
    next.outgoingMessageWebhook = 'yes'
    next.outgoingAPIMessageWebhook = 'yes'

    const response = await fetch(this.methodUrl(credentials, 'setSettings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
    const payload = await readPayload(response)
    assertNotQuota(response, payload)

    if (!response.ok) {
      throw new ApiError('Не удалось включить входящие уведомления', response.status)
    }
  }

  /**
   * Удаляет уведомление по номеру квитанции.
   * @param credentials Учётные данные инстанса.
   * @param receiptId Номер квитанции.
   * @param signal Сигнал отмены запроса.
   */
  async deleteNotification(
    credentials: Credentials,
    receiptId: number,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(`${this.methodUrl(credentials, 'deleteNotification')}/${receiptId}`, {
      method: 'DELETE',
      signal,
    })
    const payload = await readPayload(response)
    assertNotQuota(response, payload)

    if (!response.ok) {
      throw new ApiError('Не удалось удалить уведомление', response.status)
    }
  }

  /**
   * Читает настройки инстанса. Поля wid и typeInstance в SetSettings не отправляются.
   * @param credentials Учётные данные инстанса.
   * @returns Объект настроек.
   */
  private async readSettings(credentials: Credentials): Promise<Record<string, unknown>> {
    const response = await fetch(this.methodUrl(credentials, 'getSettings'))
    const payload = await readPayload(response)
    assertNotQuota(response, payload)

    if (!response.ok || !isRecord(payload)) {
      throw new ApiError('Не удалось прочитать настройки инстанса', response.status)
    }

    return payload
  }

  /**
   * Собирает URL метода инстанса.
   * @param credentials Учётные данные инстанса.
   * @param method Имя метода API.
   * @returns Абсолютный URL без query.
   */
  private methodUrl(credentials: Credentials, method: string): string {
    const id = encodeURIComponent(credentials.idInstance)
    const token = encodeURIComponent(credentials.apiTokenInstance)
    return `${this.apiUrl}/waInstance${id}/${method}/${token}`
  }
}

/**
 * Создаёт клиент GREEN-API.
 * @param apiUrl Хост инстанса.
 * @returns Клиент отправки и очереди.
 */
export function createGreenApiClient(apiUrl: string): MessageSender & NotificationQueue & InstanceSettings {
  return new GreenApiClient(apiUrl)
}

/**
 * Достаёт idMessage из ответа отправки. API может вернуть строку или число.
 * @param payload Тело ответа.
 * @returns Идентификатор или пустая строка.
 */
function readIdMessage(payload: unknown): string {
  if (!isRecord(payload)) {
    return ''
  }

  if (typeof payload.idMessage === 'string') {
    return payload.idMessage
  }

  if (typeof payload.idMessage === 'number') {
    return String(payload.idMessage)
  }

  return ''
}

/**
 * Берёт короткий текст ошибки из тела ответа.
 * @param payload Тело ответа.
 * @param fallback Текст, если в теле нет пояснения.
 * @returns Сообщение для интерфейса.
 */
function errorText(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  if (isRecord(payload) && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim()
  }

  return fallback
}

/**
 * Читает тело ответа как JSON или null.
 * @param response Ответ fetch.
 * @returns Разобранное тело или null для пустого ответа.
 */
async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/**
 * Превращает лимит чатов в отдельную ошибку.
 * @param response Ответ fetch.
 * @param payload Тело ответа.
 */
function assertNotQuota(response: Response, payload: unknown): void {
  if (response.ok) {
    return
  }

  if (response.status === 466 || payloadMentionsQuota(payload)) {
    throw new QuotaExceededError()
  }
}

/**
 * Ищет признак quotaExceeded в теле ответа.
 * @param payload Тело ответа.
 * @returns true, если лимит назван в теле.
 */
function payloadMentionsQuota(payload: unknown): boolean {
  if (typeof payload === 'string') {
    return payload.includes('quotaExceeded')
  }

  if (payload === null || typeof payload !== 'object') {
    return false
  }

  return JSON.stringify(payload).includes('quotaExceeded')
}
