import { LIST_IDS } from '@common/constants'
import { filterMusicList, formatPlayTime, toNewMusicInfo } from '@renderer/utils'
import { httpFetch } from '@renderer/utils/request'
import musicSdk from '@renderer/utils/musicSdk'
import { getListDetail } from '@renderer/store/songList/action'
import { addListMusics, createUserList } from '@renderer/store/list/action'

export type ExternalImportSource = 'tx' | 'wy' | 'kg' | 'spotify'
export type ExternalImportTarget = 'new' | 'current' | 'love'

export type ExternalImportErrorCode = 'missing_token' | 'invalid_link' | 'no_match' | 'cancelled'

export class ExternalImportError extends Error {
  code: ExternalImportErrorCode

  constructor(code: ExternalImportErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export interface ExternalImportParams {
  source: ExternalImportSource
  text: string
  listName: string
  target: ExternalImportTarget
  currentListId: string
  neteaseToken?: string
  spotifyAccessToken?: string
  spotifySavedTracks?: boolean
}

export interface ExternalImportProgress {
  stage: 'fetch' | 'match' | 'save'
  current: number
  total: number
}

export interface ExternalImportResult {
  /** 实际读取到的歌曲数 */
  total: number
  /** 来源歌单声明的歌曲总数，大于 total 时说明只读取到了一部分 */
  sourceTotal: number
  imported: number
  unmatched: number
  listName: string
}

interface SpotifyTrack {
  name: string
  singer: string
  albumName: string
  interval: string | null
}

interface SpotifyApiTrack {
  name?: string
  duration_ms?: number
  is_local?: boolean
  artists?: Array<{
    name?: string
  }>
  album?: {
    name?: string
  }
}

interface SpotifyTracksResponse {
  items: Array<{
    track?: SpotifyApiTrack | null
  }>
  next: string | null
  total: number
}

interface SpotifyPlaylistResponse {
  name?: string
}

const sourceNames: Record<ExternalImportSource, string> = {
  tx: 'QQ音乐',
  wy: '网易云音乐',
  kg: '酷狗音乐',
  spotify: 'Spotify',
}

const getDefaultListName = (source: ExternalImportSource) => {
  return `${sourceNames[source]}导入歌单`
}

const normalizeToken = (token = '') => token.trim().replace(/^Bearer\s+/i, '')

const SPOTIFY_API_ORIGIN = 'https://api.spotify.com'
// 每页 50 首，上限约 10000 首，防止异常响应导致无限翻页
const SPOTIFY_MAX_FETCH_PAGES = 200
// 国内源歌单分页上限，total/limit 来自外部响应，不可信
const NATIVE_MAX_FETCH_PAGES = 500

// 分页 next 链接来自响应体，必须校验仍指向 Spotify 官方 API，避免携带 token 请求任意地址
const isSpotifyApiUrl = (url: string) => {
  try {
    return new URL(url).origin == SPOTIFY_API_ORIGIN
  } catch {
    return false
  }
}

export type ShouldCancel = () => boolean

const assertNotCancelled = (shouldCancel?: ShouldCancel) => {
  if (shouldCancel?.()) throw new ExternalImportError('cancelled')
}

const getNeteaseInput = (text: string, token?: string) => {
  const trimmedToken = normalizeToken(token)
  if (!trimmedToken || text.includes('###')) return text
  return `${text}###${trimmedToken}`
}

const getSpotifyPlaylistId = (text: string) => {
  text = text.trim()
  if (!text) return ''

  let result = /open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/.exec(text)
  if (result) return result[1]

  result = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(text)
  if (result) return result[1]

  const id = text.replace(/[?#].*$/, '')
  return /^[A-Za-z0-9]+$/.test(id) ? id : ''
}

const fetchSpotifyJson = async<T>(url: string, accessToken: string): Promise<T> => {
  const token = normalizeToken(accessToken)
  if (!token) throw new ExternalImportError('missing_token')

  const request = httpFetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: 20000,
  }) as unknown as { promise: Promise<{ statusCode?: number, body: unknown }> }
  const { statusCode, body } = await request.promise

  if (statusCode && statusCode >= 400) {
    const message = typeof body == 'object' && body && 'error' in body
      ? JSON.stringify(body.error)
      : `Spotify request failed: ${statusCode}`
    throw new Error(message)
  }
  return body as T
}

const toSpotifyTracks = (items: SpotifyTracksResponse['items']) => {
  const tracks: SpotifyTrack[] = []
  if (!Array.isArray(items)) return tracks
  for (const item of items) {
    const track = item.track
    if (!track) continue
    if (track.is_local) continue
    if (!track.name) continue
    tracks.push({
      name: track.name,
      singer: track.artists?.map(artist => artist.name).filter(Boolean).join('、') ?? '',
      albumName: track.album?.name ?? '',
      interval: track.duration_ms ? formatPlayTime(track.duration_ms / 1000) : null,
    })
  }
  return tracks
}

const fetchSpotifyTracks = async(params: ExternalImportParams, onProgress?: (progress: ExternalImportProgress) => void, shouldCancel?: ShouldCancel) => {
  const token = params.spotifyAccessToken ?? ''
  const tracks: SpotifyTrack[] = []
  let listName = getDefaultListName('spotify')
  let url: string

  if (params.spotifySavedTracks) {
    listName = 'Spotify 喜欢的歌曲'
    url = `${SPOTIFY_API_ORIGIN}/v1/me/tracks?limit=50`
  } else {
    const playlistId = getSpotifyPlaylistId(params.text)
    if (!playlistId) throw new ExternalImportError('invalid_link')
    const playlist = await fetchSpotifyJson<SpotifyPlaylistResponse>(`${SPOTIFY_API_ORIGIN}/v1/playlists/${playlistId}?fields=name`, token)
    listName = playlist.name ?? listName
    url = `${SPOTIFY_API_ORIGIN}/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(name,album(name),artists(name),duration_ms,is_local)),next,total`
  }

  let total = 0
  let page = 0
  while (url && page < SPOTIFY_MAX_FETCH_PAGES) {
    assertNotCancelled(shouldCancel)
    let data: SpotifyTracksResponse
    try {
      data = await fetchSpotifyJson<SpotifyTracksResponse>(url, token)
    } catch (error) {
      // 已拿到部分数据时不整单作废，用已抓取的曲目继续后续流程
      if (tracks.length) break
      throw error
    }
    page++
    if (!total && typeof data.total == 'number') total = data.total
    tracks.push(...toSpotifyTracks(data.items))
    onProgress?.({
      stage: 'fetch',
      current: total ? Math.min(tracks.length, total) : tracks.length,
      total,
    })
    url = typeof data.next == 'string' && isSpotifyApiUrl(data.next) ? data.next : ''
  }

  return {
    listName,
    tracks,
    sourceTotal: Math.max(total, tracks.length),
  }
}

const matchSpotifyTracks = async(tracks: SpotifyTrack[], onProgress?: (progress: ExternalImportProgress) => void, shouldCancel?: ShouldCancel) => {
  const matchedList: LX.Music.MusicInfo[] = []
  let unmatched = 0

  for (let index = 0; index < tracks.length; index++) {
    assertNotCancelled(shouldCancel)
    const track = tracks[index]
    const result = await musicSdk.findMusic({
      name: track.name,
      singer: track.singer,
      albumName: track.albumName,
      interval: track.interval,
      source: 'spotify',
    }).catch(() => [])

    if (result.length) matchedList.push(toNewMusicInfo(result[0]))
    else unmatched++

    onProgress?.({
      stage: 'match',
      current: index + 1,
      total: tracks.length,
    })
  }

  return {
    list: filterMusicList(matchedList),
    unmatched,
  }
}

const fetchNativeList = async(params: ExternalImportParams, onProgress?: (progress: ExternalImportProgress) => void, shouldCancel?: ShouldCancel) => {
  const source = params.source as Exclude<ExternalImportSource, 'spotify'>
  const text = source == 'wy' ? getNeteaseInput(params.text, params.neteaseToken) : params.text
  const detail = await getListDetail(text, source, 1, true)
  const list: LX.Music.MusicInfo[] = [...detail.list]

  const total = typeof detail.total == 'number' && detail.total > 0 ? detail.total : list.length
  const limit = typeof detail.limit == 'number' && detail.limit > 0 ? detail.limit : Math.max(list.length, 1)
  const maxPage = Math.min(Math.ceil(total / limit), NATIVE_MAX_FETCH_PAGES)
  onProgress?.({
    stage: 'fetch',
    current: Math.min(list.length, total),
    total,
  })

  for (let page = 2; page <= maxPage; page++) {
    assertNotCancelled(shouldCancel)
    let pageDetail
    try {
      pageDetail = await getListDetail(text, source, page)
    } catch (error) {
      // 已拿到部分数据时不整单作废，用已抓取的曲目继续后续流程
      if (list.length) break
      throw error
    }
    list.push(...pageDetail.list)
    onProgress?.({
      stage: 'fetch',
      current: Math.min(list.length, total),
      total,
    })
  }

  return {
    listName: detail.info?.name ?? getDefaultListName(source),
    list,
    unmatched: 0,
    sourceTotal: Math.max(total, list.length),
  }
}

const writeMusicList = async(params: ExternalImportParams, list: LX.Music.MusicInfo[], onProgress?: (progress: ExternalImportProgress) => void) => {
  const musicInfos = filterMusicList(list)
  if (!musicInfos.length) throw new ExternalImportError('no_match')

  onProgress?.({
    stage: 'save',
    current: 0,
    total: musicInfos.length,
  })

  switch (params.target) {
    case 'new':
      await createUserList({
        name: params.listName || getDefaultListName(params.source),
        list: musicInfos,
      })
      break
    case 'love':
      await addListMusics(LIST_IDS.LOVE, musicInfos)
      break
    case 'current':
    default:
      await addListMusics(params.currentListId, musicInfos)
      break
  }

  onProgress?.({
    stage: 'save',
    current: musicInfos.length,
    total: musicInfos.length,
  })

  return musicInfos.length
}

export const importExternalPlaylist = async(params: ExternalImportParams, onProgress?: (progress: ExternalImportProgress) => void, shouldCancel?: ShouldCancel): Promise<ExternalImportResult> => {
  let listName = params.listName || getDefaultListName(params.source)
  let list: LX.Music.MusicInfo[]
  let total: number
  let sourceTotal: number
  let unmatched = 0

  if (params.source == 'spotify') {
    const spotifyResult = await fetchSpotifyTracks(params, onProgress, shouldCancel)
    listName = params.listName || spotifyResult.listName
    const matchedResult = await matchSpotifyTracks(spotifyResult.tracks, onProgress, shouldCancel)
    list = matchedResult.list
    total = spotifyResult.tracks.length
    sourceTotal = spotifyResult.sourceTotal
    unmatched = matchedResult.unmatched
  } else {
    const nativeResult = await fetchNativeList(params, onProgress, shouldCancel)
    listName = params.listName || nativeResult.listName
    list = nativeResult.list
    total = nativeResult.list.length
    sourceTotal = nativeResult.sourceTotal
    unmatched = nativeResult.unmatched
  }

  assertNotCancelled(shouldCancel)
  const imported = await writeMusicList({
    ...params,
    listName,
  }, list, onProgress)

  return {
    total,
    sourceTotal,
    imported,
    unmatched,
    listName,
  }
}
