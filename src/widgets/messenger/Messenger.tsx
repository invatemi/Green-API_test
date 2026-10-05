import { selectActiveChatId, useAppSelector } from '@/entities'

import { ChatList } from '../chat-list'
import { ChatWindow } from '../chat-window'
import styles from './Messenger.module.css'

/**
 * Раскладка списка чатов и окна переписки на одном маршруте.
 * @returns Две колонки или один экран на узкой ширине.
 */
export function Messenger() {
  const activeChatId = useAppSelector(selectActiveChatId)
  const className = activeChatId ? `${styles.shell} ${styles.chatOpen}` : styles.shell

  return (
    <div className={className}>
      <ChatList />
      <ChatWindow />
    </div>
  )
}
