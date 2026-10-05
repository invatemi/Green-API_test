import { useState, type FormEvent } from 'react'

import { useAppDispatch } from '@/entities'
import { createChat } from '@/features'
import { Button, TextField } from '@/shared/ui'

import styles from './ChatList.module.css'

/**
 * Поле номера и создание чата. Черновик не перерисовывает список.
 * @returns Форма нового чата.
 */
export function CreateChatForm() {
  const dispatch = useAppDispatch()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  /**
   * Создаёт чат или выбирает существующий.
   * @param event Событие отправки формы.
   */
  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await dispatch(createChat(phone))

    if (createChat.fulfilled.match(result)) {
      setPhone('')
      setError(null)
      return
    }

    setError(typeof result.payload === 'string' ? result.payload : 'Не удалось создать чат')
  }

  return (
    <form className={styles.composer} onSubmit={onCreate}>
      <TextField
        id="new-chat-phone"
        label="Номер телефона"
        inputMode="tel"
        value={phone}
        placeholder="79876543210"
        onChange={(event) => setPhone(event.target.value)}
      />
      {error ? <p className={styles.error}>{error}</p> : null}
      <Button type="submit">Создать чат</Button>
    </form>
  )
}
