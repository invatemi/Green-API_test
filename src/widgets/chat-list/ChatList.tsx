import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import { ChatCard, chatSelected, selectChatRows, useAppDispatch, useAppSelector } from '@/entities'
import { logout } from '@/features'

import { CreateChatForm } from './CreateChatForm'
import styles from './ChatList.module.css'

/**
 * Список чатов, создание чата по номеру и выход.
 * @returns Боковая панель переписок.
 */
export function ChatList() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const rows = useAppSelector(selectChatRows)
  const onSelect = useCallback(
    (chatId: string) => {
      dispatch(chatSelected(chatId))
    },
    [dispatch],
  )

  /**
   * Выходит и возвращает на экран входа.
   */
  async function onLogout() {
    await dispatch(logout())
    navigate('/', { replace: true })
  }

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Чаты</h1>
          <button className={styles.logout} type="button" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </header>
      <ul className={styles.list}>
        {rows.length === 0 ? <li className={styles.empty}>Чатов пока нет</li> : null}
        {rows.map((row) => (
          <li key={row.chatId}>
            <ChatCard
              chatId={row.chatId}
              phone={row.phone}
              preview={row.preview}
              unread={row.unread}
              active={row.active}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
      <CreateChatForm />
    </aside>
  )
}
