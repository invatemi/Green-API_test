const MIN_DIGITS = 10
const MAX_DIGITS = 15

/** Результат разбора номера телефона. */
export type PhoneResult =
  | { ok: true; phone: string; chatId: string }
  | { ok: false; reason: string }

/**
 * Приводит ввод к chatId личного чата GREEN-API.
 * @param input Номер в свободной записи.
 * @returns Цифры и chatId с суффиксом @c.us либо русская причина отказа.
 */
export function normalizePhone(input: string): PhoneResult {
  if (/[a-zA-Zа-яА-ЯёЁ]/.test(input)) {
    return { ok: false, reason: 'Номер должен содержать только цифры' }
  }

  const phone = input.replace(/\D/g, '')

  if (!phone) {
    return { ok: false, reason: 'Введите номер телефона' }
  }

  if (phone.length < MIN_DIGITS || phone.length > MAX_DIGITS) {
    return { ok: false, reason: 'Номер должен содержать от 10 до 15 цифр' }
  }

  return { ok: true, phone, chatId: `${phone}@c.us` }
}
