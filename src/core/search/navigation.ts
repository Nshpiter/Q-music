export interface SearchNavigationRequest {
  keyword: string
  source: LX.OnlineSource | 'all'
  related?: { kind: 'album', song: LX.Music.MusicInfo }
}

// 搜索页可能尚未挂载；保留最新请求，避免切换主页时丢失自动搜索。
let pending: SearchNavigationRequest | null = null
const listeners = new Set<() => void>()
export const requestSearch = (request: SearchNavigationRequest) => {
  pending = request
  for (const listener of listeners) listener()
}
export const takeSearchRequest = () => {
  const request = pending
  pending = null
  return request
}
export const onSearchRequest = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const buildSongSearchRequest = (song: LX.Music.MusicInfo, kind: 'song' | 'artist' | 'album', artist = song.singer): SearchNavigationRequest => {
  const keyword = (kind == 'artist' ? artist : kind == 'album' ? song.meta.albumName : song.name).trim()
  const albumId = song.source == 'local' ? null : song.source == 'tx' && song.meta.albumMid ? song.meta.albumMid : song.meta.albumId
  return {
    keyword,
    source: song.source == 'local' ? 'all' : song.source,
    ...(kind == 'album' && ['tx', 'wy', 'kg'].includes(song.source) && albumId ? { related: { kind, song } } : {}),
  }
}
