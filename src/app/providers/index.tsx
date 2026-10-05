import { useEffect, type ReactNode } from 'react'
import { Provider } from 'react-redux'

import { useAppDispatch, useAppSelector } from '@/entities'
import { runReceiveLoop } from '@/features'
import { store } from '../store/store'

type AppProvidersProps = {
  children: ReactNode
}

/**
 * Подключает store и цикл опроса очереди.
 * @param props Дочернее дерево приложения.
 * @returns Провайдер Redux.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <Provider store={store}>
      <ReceiveBridge />
      {children}
    </Provider>
  )
}

/**
 * Запускает один цикл опроса на время сессии.
 * Переход между / и /messenger его не перезапускает: мост живёт над роутером.
 * @returns Пустой узел.
 */
function ReceiveBridge() {
  const dispatch = useAppDispatch()
  const idInstance = useAppSelector((state) => state.session.credentials?.idInstance ?? null)
  const token = useAppSelector((state) => state.session.credentials?.apiTokenInstance ?? null)

  useEffect(() => {
    if (!idInstance || !token) {
      return undefined
    }

    const controller = new AbortController()
    void runReceiveLoop(dispatch, controller.signal)
    return () => controller.abort()
  }, [dispatch, idInstance, token])

  return null
}
