import { resetLegacyStorage } from '@/entities/storage'
import { createGreenApiClient } from '@/shared/api/green-api'
import { getApiUrl } from '@/shared/config'
import { webStorage } from '@/shared/lib'

import { createAppStore } from './createAppStore'

resetLegacyStorage(window.sessionStorage, window.localStorage)

const client = createGreenApiClient(getApiUrl())

/** Единственный store вкладки. */
export const store = createAppStore({
  sender: client,
  queue: client,
  settings: client,
  session: webStorage(window.sessionStorage),
  local: webStorage(window.localStorage),
})
