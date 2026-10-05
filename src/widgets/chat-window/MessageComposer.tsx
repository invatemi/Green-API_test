import { useState, type FormEvent } from 'react'

import { useAppDispatch } from '@/entities'
import { sendMessage } from '@/features'
import { Button, TextField } from '@/shared/ui'

import styles from './ChatWindow.module.css'

type MessageComposerProps = {
  activeChatId: string | null
}

/**
 * Поле текста и отправка. Черновик не перерисовывает ленту.
 * @param props Идентификатор открытого чата.
 * @returns Форма сообщения.
 */
export function MessageComposer({ activeChatId }: MessageComposerProps) {
  const dispatch = useAppDispatch()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  /**
   * Отправляет текст в активный чат.
   * @param event Событие отправки формы.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeChatId) {
      return
    }

    const result = await dispatch(sendMessage({ chatId: activeChatId, text }))
    if (sendMessage.fulfilled.match(result)) {
      setText('')
      setError(null)
      return
    }

    const failure = result.payload
    setError(failure?.reason ?? 'Не удалось отправить сообщение')
  }

  return (
    <form className={styles.composer} onSubmit={onSubmit}>
      <div className={styles.field}>
        <TextField
          id="message-text"
          label="Сообщение"
          value={text}
          disabled={!activeChatId}
          placeholder="Текст сообщения"
          onChange={(event) => setText(event.target.value)}
        />
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
      <Button type="submit" disabled={!activeChatId}>
        Отправить
      </Button>
    </form>
  )
}
