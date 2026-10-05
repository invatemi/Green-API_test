import { createAction } from '@reduxjs/toolkit'

import type { NotificationEffect } from './apply'

/**
 * Сообщает слайсам решение политики уведомления.
 */
export const notificationApplied = createAction<NotificationEffect>('notification/applied')
