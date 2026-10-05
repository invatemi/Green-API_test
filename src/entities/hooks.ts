import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux'
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'

import type { AppDeps } from '@/shared/api/deps'

import type { MessengerState } from './state'

/** Dispatch thunks мессенджера. */
export type AppDispatch = ThunkDispatch<MessengerState, AppDeps, UnknownAction>

/** Типизированный dispatch. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()

/** Типизированный селектор состояния. */
export const useAppSelector: TypedUseSelectorHook<MessengerState> = useSelector
