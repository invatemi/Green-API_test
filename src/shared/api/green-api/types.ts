/** Учётные данные инстанса, которые пользователь вводит на экране входа. */
export interface Credentials {
  idInstance: string
  apiTokenInstance: string
}

/** Ответ метода SendMessage. */
export interface SentMessage {
  idMessage: string
}

/** Уведомление из очереди HTTP API. */
export interface QueuedNotification {
  receiptId: number
  body: unknown
}

/** Порт отправки текстового сообщения. */
export interface MessageSender {
  /**
   * Отправляет текст в личный чат.
   * @param credentials Учётные данные инстанса.
   * @param chatId Идентификатор чата вида digits@c.us.
   * @param message Текст сообщения.
   * @returns Идентификатор сообщения на стороне API.
   */
  sendText(credentials: Credentials, chatId: string, message: string): Promise<SentMessage>
}

/** Порт очереди входящих уведомлений. */
export interface NotificationQueue {
  /**
   * Забирает одно уведомление из очереди.
   * @param credentials Учётные данные инстанса.
   * @param signal Сигнал отмены долгого запроса.
   * @returns Уведомление или null, если очередь пуста.
   */
  receiveNotification(
    credentials: Credentials,
    signal?: AbortSignal,
  ): Promise<QueuedNotification | null>

  /**
   * Удаляет обработанное уведомление из очереди.
   * @param credentials Учётные данные инстанса.
   * @param receiptId Номер квитанции из receiveNotification.
   * @param signal Сигнал отмены запроса.
   */
  deleteNotification(
    credentials: Credentials,
    receiptId: number,
    signal?: AbortSignal,
  ): Promise<void>
}

/** Порт настроек инстанса, от которых зависит очередь HTTP API. */
export interface InstanceSettings {
  /**
   * Включает постановку входящих сообщений в очередь ReceiveNotification.
   * @param credentials Учётные данные инстанса.
   */
  enableIncomingQueue(credentials: Credentials): Promise<void>
}
