/** Предел длины текста в SendMessage. */
export const MESSAGE_MAX_LENGTH = 4096

/** Результат проверки текста сообщения. */
export type TextResult = { ok: true; text: string } | { ok: false; reason: string }

/**
 * Проверяет текст исходящего сообщения.
 * @param input Строка из поля ввода.
 * @returns Обрезанный текст либо русская причина отказа.
 */
export function validateMessageText(input: string): TextResult {
  const text = input.trim()

  if (!text) {
    return { ok: false, reason: 'Введите текст сообщения' }
  }

  if (text.length > MESSAGE_MAX_LENGTH) {
    return { ok: false, reason: 'Сообщение не длиннее 4096 символов' }
  }

  return { ok: true, text }
}
