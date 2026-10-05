import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { useAppDispatch } from '@/entities'
import { login } from '@/features'
import { Button, TextField } from '@/shared/ui'

import styles from './LoginForm.module.css'

/**
 * Экран входа по учётным данным GREEN-API.
 * @returns Карточка с полями idInstance и apiTokenInstance.
 */
export function LoginForm() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [error, setError] = useState<string | null>(null)

  /**
   * Входит и открывает переписку.
   * @param event Событие отправки формы.
   */
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await dispatch(login({ idInstance, apiTokenInstance }))

    if (login.fulfilled.match(result)) {
      navigate('/messenger', { replace: true })
      return
    }

    setError(typeof result.payload === 'string' ? result.payload : 'Не удалось войти')
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1 className={styles.title}>Вход</h1>
        <p className={styles.hint}>Введите данные инстанса GREEN-API для Telegram.</p>
        <TextField
          id="id-instance"
          label="idInstance"
          value={idInstance}
          autoComplete="username"
          onChange={(event) => setIdInstance(event.target.value)}
        />
        <TextField
          id="api-token"
          label="apiTokenInstance"
          type="password"
          value={apiTokenInstance}
          autoComplete="current-password"
          onChange={(event) => setApiTokenInstance(event.target.value)}
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <Button type="submit">Войти</Button>
      </form>
    </main>
  )
}
