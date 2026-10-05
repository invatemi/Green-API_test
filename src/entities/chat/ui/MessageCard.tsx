import { memo } from 'react'

import type { MessageDirection, MessageStatus } from '../model'

import styles from './MessageCard.module.css'

type MessageCardProps = {
  direction: MessageDirection
  text: string
  status: MessageStatus
  timestamp: number
}

/**
 * Пузырь одного текстового сообщения.
 * @param props Направление, текст, статус и время.
 * @returns Карточка сообщения.
 */
export const MessageCard = memo(function MessageCard({ direction, text, status, timestamp }: MessageCardProps) {
  return (
    <li className={direction === 'out' ? styles.outgoing : styles.incoming}>
      <p className={styles.text}>{text}</p>
      <p className={status === 'failed' ? styles.failed : styles.meta}>
        {status === 'pending' ? 'Отправка…' : null}
        {status === 'failed' ? 'Не отправлено' : null}
        {status === 'sent' ? formatTime(timestamp) : null}
      </p>
    </li>
  )
})

/**
 * Показывает время сообщения. Секунды UNIX переводит в миллисекунды.
 * @param timestamp Метка времени сообщения.
 * @returns Время в локали ru или пустая строка.
 */
function formatTime(timestamp: number): string {
  if (!timestamp) {
    return ''
  }

  const millis = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp
  return new Date(millis).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}
