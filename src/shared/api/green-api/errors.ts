/** Ошибка ответа GREEN-API. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined

  /**
   * Создаёт ошибку HTTP-ответа.
   * @param message Текст для интерфейса.
   * @param status Код ответа.
   * @param code Машинный код, если он есть в теле.
   */
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** Месячный лимит новых чатов на тарифе «Разработчик» исчерпан. */
export class QuotaExceededError extends ApiError {
  /**
   * Создаёт ошибку лимита чатов.
   */
  constructor() {
    super('Месячный лимит чатов исчерпан', 466, 'quotaExceeded')
    this.name = 'QuotaExceededError'
  }
}
