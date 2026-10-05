import { useLayoutEffect, useRef } from 'react'

import {
  MessageCard,
  activeChatCleared,
  selectActiveChatId,
  selectActiveMessages,
  selectQuotaExceeded,
  useAppDispatch,
  useAppSelector,
} from '@/entities'

import { MessageComposer } from './MessageComposer'
import styles from './ChatWindow.module.css'

/**
 * Лента активного чата и поле отправки.
 * @returns Окно переписки.
 */
export function ChatWindow() {
  const dispatch = useAppDispatch()
  const activeChatId = useAppSelector(selectActiveChatId)
  const messages = useAppSelector(selectActiveMessages)
  const quotaExceeded = useAppSelector(selectQuotaExceeded)
  const phone = useAppSelector(
    (state) => state.chats.chats.find((chat) => chat.chatId === state.chats.activeChatId)?.phone ?? '',
  )
  const threadRef = useRef<HTMLUListElement>(null)
  const lastMessageId = messages[messages.length - 1]?.idMessage

  useLayoutEffect(() => {
    const thread = threadRef.current
    if (!thread) {
      return
    }

    thread.scrollTop = thread.scrollHeight
  }, [activeChatId, lastMessageId, messages.length])

  return (
    <section className={styles.window}>
      <header className={styles.header}>
        <button className={styles.back} type="button" onClick={() => dispatch(activeChatCleared())}>
          Назад
        </button>
        <h2 className={styles.title}>{phone || 'Переписка'}</h2>
      </header>
      {quotaExceeded ? <p className={styles.banner}>Месячный лимит чатов исчерпан</p> : null}
      <ul className={styles.thread} ref={threadRef}>
        {!activeChatId ? <li className={styles.empty}>Выберите чат или создайте новый по номеру телефона.</li> : null}
        {activeChatId && messages.length === 0 ? <li className={styles.empty}>Напишите первое сообщение.</li> : null}
        {messages.map((message) => (
          <MessageCard
            key={message.idMessage}
            direction={message.direction}
            text={message.text}
            status={message.status}
            timestamp={message.timestamp}
          />
        ))}
      </ul>
      <MessageComposer activeChatId={activeChatId} />
    </section>
  )
}
