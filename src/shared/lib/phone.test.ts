import { describe, expect, it } from 'vitest'

import { normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('собирает chatId из номера с плюсом, пробелами и скобками', () => {
    expect(normalizePhone('+7 (987) 654-32-10')).toEqual({
      ok: true,
      phone: '79876543210',
      chatId: '79876543210@c.us',
    })
  })

  it('отклоняет пустую строку и буквы', () => {
    expect(normalizePhone('')).toEqual({ ok: false, reason: 'Введите номер телефона' })
    expect(normalizePhone('   ')).toEqual({ ok: false, reason: 'Введите номер телефона' })
    expect(normalizePhone('abc')).toEqual({
      ok: false,
      reason: 'Номер должен содержать только цифры',
    })
  })

  it('принимает номер ровно из 10 и ровно из 15 цифр', () => {
    expect(normalizePhone('1'.repeat(10))).toMatchObject({ ok: true, phone: '1'.repeat(10) })
    expect(normalizePhone('1'.repeat(15))).toMatchObject({ ok: true, chatId: `${'1'.repeat(15)}@c.us` })
  })

  it('отклоняет номер короче 10 и длиннее 15 цифр', () => {
    expect(normalizePhone('12345')).toEqual({
      ok: false,
      reason: 'Номер должен содержать от 10 до 15 цифр',
    })
    expect(normalizePhone('1'.repeat(16))).toEqual({
      ok: false,
      reason: 'Номер должен содержать от 10 до 15 цифр',
    })
  })
})
