import { memo } from 'react'

import styles from './ChatCard.module.css'

type ChatCardProps = {
  chatId: string
  phone: string
  preview: string
  unread: number
  active: boolean
  onSelect: (chatId: string) => void
}

/**
 * Строка чата: номер, превью и число непрочитанных.
 * @param props Данные строки и выбор чата.
 * @returns Кнопка чата.
 */
export const ChatCard = memo(function ChatCard({
  chatId,
  phone,
  preview,
  unread,
  active,
  onSelect,
}: ChatCardProps) {
  return (
    <button
      className={active ? styles.chatActive : styles.chat}
      type="button"
      onClick={() => onSelect(chatId)}
    >
      <span className={styles.phone}>{phone}</span>
      <span className={styles.previewRow}>
        <span className={styles.preview}>{preview}</span>
        {unread > 0 ? <span className={styles.badge}>{unread}</span> : null}
      </span>
    </button>
  )
})
