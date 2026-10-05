import type { KeyValueStorage } from '@/shared/lib'

import type { InstanceSettings, MessageSender, NotificationQueue } from './green-api'

/** Зависимости thunks: порты API и зеркала storage. */
export interface AppDeps {
  sender: MessageSender
  queue: NotificationQueue
  settings: InstanceSettings
  local: KeyValueStorage
  session: KeyValueStorage
}
