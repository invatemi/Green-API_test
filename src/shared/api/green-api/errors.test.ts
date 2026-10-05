import { describe, expect, it } from 'vitest'

import { ApiError, QuotaExceededError } from './errors'

describe('ApiError', () => {
  it('хранит текст, статус и код', () => {
    const error = new ApiError('Не удалось отправить сообщение', 500, 'send-failed')

    expect(error).toMatchObject({
      name: 'ApiError',
      message: 'Не удалось отправить сообщение',
      status: 500,
      code: 'send-failed',
    })
  })

  it('лимит чатов является ApiError со статусом 466', () => {
    const error = new QuotaExceededError()

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toBeInstanceOf(QuotaExceededError)
    expect(error).toMatchObject({ status: 466, code: 'quotaExceeded', message: 'Месячный лимит чатов исчерпан' })
  })

  it('код лимита отличает его от обычной ошибки того же статуса', () => {
    const generic = new ApiError('Месячный лимит чатов исчерпан', 466)

    expect(generic).not.toBeInstanceOf(QuotaExceededError)
    expect(generic.code).toBeUndefined()
  })
})
