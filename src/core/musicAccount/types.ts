export type MusicAccountProvider = 'tx' | 'wy'

export type MusicAccountConnectionState = 'connected' | 'expired' | 'disconnected'

export interface MusicAccountUrlResult {
  provider: MusicAccountProvider
  status: 'available' | 'login_required' | 'unavailable' | 'error'
  url: string
  quality: LX.Quality
}
