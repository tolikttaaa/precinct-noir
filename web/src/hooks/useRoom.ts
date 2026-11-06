import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { saveCredentials, type Credentials, type Role } from '../net/credentials'
import { RoomSocket, socketUrl, type Command, type RoomState } from '../net/roomSocket'

export interface RoomHandle {
  readonly state: RoomState
  readonly send: (command: Command) => void
}

/** Connects this screen to room [code] while it is shown, and keeps the command count saved. */
export function useRoom(code: string, role: Role, credentials: Credentials): RoomHandle {
  const socket = useMemo(
    () =>
      new RoomSocket({
        url: socketUrl(),
        room: code,
        token: credentials.token,
        clientSeq: credentials.clientSeq,
        onClientSeq: (clientSeq) => saveCredentials(code, role, { ...credentials, clientSeq }),
      }),
    [code, role, credentials],
  )
  useEffect(() => {
    socket.start()
    return () => socket.stop()
  }, [socket])
  const state = useSyncExternalStore(socket.subscribe, socket.getState)
  return useMemo(
    () => ({ state, send: (command: Command) => socket.send(command) }),
    [state, socket],
  )
}
