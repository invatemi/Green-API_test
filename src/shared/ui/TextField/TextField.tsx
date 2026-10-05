import type { InputHTMLAttributes } from 'react'

import styles from './TextField.module.css'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  id: string
}

/**
 * Тёмное поле с подписью.
 * @param props Подпись, id и атрибуты input.
 * @returns Подпись и поле ввода.
 */
export function TextField({ label, id, ...props }: TextFieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <input id={id} {...props} />
    </label>
  )
}
