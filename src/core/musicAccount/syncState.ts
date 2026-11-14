export interface PlaylistSyncState {
  phase: 'fetch' | 'save' | 'success' | 'error'
  current: number
  total: number
  error?: string
}
export const playlistSyncErrorKey = (code?: string) => {
  if (code == 'login_required') return 'list_sync_login_required'
  if (code == 'account_changed') return 'list_sync_account_changed'
  if (code == 'verification_required') return 'list_sync_verification_required'
  if (code == 'incomplete' || code == 'playlist_incomplete') return 'list_sync_incomplete'
  if (code == 'network') return 'list_sync_network'
  if (code == 'restricted') return 'list_sync_restricted'
  if (code == 'cancelled') return 'list_sync_cancelled'
  if (code == 'list_removed') return 'list_sync_removed'
  return 'list_sync_failed'
}
let state: Record<string, PlaylistSyncState> = {}
const listeners = new Set<() => void>()
export const getPlaylistSyncState = () => state
export const subscribePlaylistSync = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const setPlaylistSyncState = (id: string, next: PlaylistSyncState) => {
  state = { ...state, [id]: next }
  for (const listener of listeners) listener()
}
