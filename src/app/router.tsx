import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { selectCredentials, useAppSelector } from '@/entities'
import { LoginForm, Messenger } from '@/widgets'

/**
 * Клиентские маршруты SPA: вход и переписка.
 * @returns Роутер с двумя адресами.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GuestOnly><LoginForm /></GuestOnly>} />
        <Route path="/messenger" element={<RequireSession><Messenger /></RequireSession>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

/**
 * Пускает на переписку только при живой сессии.
 * @param props Дочерний экран.
 * @returns Экран или переход на вход.
 */
function RequireSession({ children }: { children: ReactNode }) {
  const credentials = useAppSelector(selectCredentials)

  if (!credentials) {
    return <Navigate to="/" replace />
  }

  return children
}

/**
 * Уводит уже вошедшего пользователя на переписку.
 * @param props Дочерний экран входа.
 * @returns Экран входа или переход на /messenger.
 */
function GuestOnly({ children }: { children: ReactNode }) {
  const credentials = useAppSelector(selectCredentials)

  if (credentials) {
    return <Navigate to="/messenger" replace />
  }

  return children
}
