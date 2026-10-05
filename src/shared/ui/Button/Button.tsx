import type { ButtonHTMLAttributes } from 'react'

import styles from './Button.module.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/**
 * Кнопка с акцентным цветом темы.
 * @param props Атрибуты кнопки.
 * @returns Кнопка.
 */
export function Button({ className, type = 'button', ...props }: ButtonProps) {
  const classes = className ? `${styles.button} ${className}` : styles.button

  return <button className={classes} type={type} {...props} />
}
