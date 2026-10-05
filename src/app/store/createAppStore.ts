import { configureStore } from '@reduxjs/toolkit'

import { chatsReducer, sessionReducer } from '@/entities'
import { persistSnapshot, readInitialState } from '@/entities/storage'
import type { AppDeps } from '@/shared/api/deps'

/**
 * Создаёт store мессенджера и подписывает его на запись в storage.
 * @param deps Порты API и зеркала storage.
 * @returns Настроенный store.
 */
export function createAppStore(deps: AppDeps) {
  const store = configureStore({
    reducer: {
      session: sessionReducer,
      chats: chatsReducer,
    },
    preloadedState: readInitialState(deps.session, deps.local),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: deps },
      }),
  })

  store.subscribe(() => {
    persistSnapshot(store.getState(), deps.session, deps.local)
  })

  return store
}

/** Store приложения. */
export type AppStore = ReturnType<typeof createAppStore>

/** Dispatch с thunks и extraArgument. */
export type AppDispatch = AppStore['dispatch']
