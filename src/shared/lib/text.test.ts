import { describe, expect, it } from 'vitest'

import { MESSAGE_MAX_LENGTH, validateMessageText } from './text'

describe('validateMessageText', () => {
  it('отклоняет пустую строку', () => {
    expect(validateMessageText('')).toEqual({ ok: false, reason: 'Введите текст сообщения' })
  })

  it('отклоняет строку из пробелов', () => {
    expect(validateMessageText('   ')).toEqual({ ok: false, reason: 'Введите текст сообщения' })
  })

  it('обрезает пробелы по краям и оставляет текст внутри', () => {
    expect(validateMessageText('  привет  ')).toEqual({ ok: true, text: 'привет' })
  })

  it('принимает 4096 символов и отклоняет 4097', () => {
    const limit = 'а'.repeat(MESSAGE_MAX_LENGTH)
    const over = 'а'.repeat(MESSAGE_MAX_LENGTH + 1)

    expect(validateMessageText(limit)).toEqual({ ok: true, text: limit })
    expect(validateMessageText(over)).toEqual({
      ok: false,
      reason: 'Сообщение не длиннее 4096 символов',
    })
  })
})
