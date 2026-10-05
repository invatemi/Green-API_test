import type { ChatsState } from './chat/chatsSlice'
import type { SessionState } from './session/sessionSlice'

/** Состояние мессенджера, которое видят thunks и persist. */
export interface MessengerState {
  session: SessionState
  chats: ChatsState
}
