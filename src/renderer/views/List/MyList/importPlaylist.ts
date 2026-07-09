import { LIST_IDS } from '@common/constants'
import { filterMusicList, formatPlayTime, toNewMusicInfo } from '@renderer/utils'
import { httpFetch } from '@renderer/utils/request'
import musicSdk from '@renderer/utils/musicSdk'
import { getListDetail, getListDetailAll } from '@renderer/store/songList/action'
import { addListMusics, createUserList } from '@renderer/store/list/action'

export type ExternalImportSource = 'tx' | 'wy' | 'kg' | 'spotify'
export type ExternalImportTarget = 'new' | 'current' | 'love'

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
  total: number
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

  return text.replace(/[?#].*$/, '')
}

const fetchSpotifyJson = async<T>(url: string, accessToken: string): Promise<T> => {
  const token = normalizeToken(accessToken)
  if (!token) throw new Error('Missing Spotify access token')

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

const fetchSpotifyTracks = async(params: ExternalImportParams, onProgress?: (progress: ExternalImportProgress) => void) => {
  const token = params.spotifyAccessToken ?? ''
  const tracks: SpotifyTrack[] = []
  let listName = getDefaultListName('spotify')
  let url: string

  if (params.spotifySavedTracks) {
    listName = 'Spotify 喜欢的歌曲'
    url = 'https://api.spotify.com/v1/me/tracks?limit=50'
  } else {
    const playlistId = getSpotifyPlaylistId(params.text)
    if (!playlistId) throw new Error('Spotify playlist id is empty')
    const playlist = await fetchSpotifyJson<SpotifyPlaylistResponse>(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, token)
    listName = playlist.name ?? listName
    url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(name,album(name),artists(name),duration_ms,is_local)),next,total`
  }

  let total = 0
  while (url) {
    const data = await fetchSpotifyJson<SpotifyTracksResponse>(url, token)
    total ||= data.total
    tracks.push(...toSpotifyTracks(data.items))
    onProgress?.({
      stage: 'fetch',
      current: Math.min(tracks.length, total),
      total,
    })
    url = data.next ?? ''
  }

  return {
    listName,
    tracks,
  }
}

const matchSpotifyTracks = async(tracks: SpotifyTrack[], onProgress?: (progress: ExternalImportProgress) => void) => {
  const matchedList: LX.Music.MusicInfo[] = []
  let unmatched = 0

  for (let index = 0; index < tracks.length; index++) {
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

const fetchNativeList = async(params: ExternalImportParams) => {
  const source = params.source as Exclude<ExternalImportSource, 'spotify'>
  const text = source == 'wy' ? getNeteaseInput(params.text, params.neteaseToken) : params.text
  const detail = await getListDetail(text, source, 1, true)
  const list = await getListDetailAll(text, source)
  return {
    listName: detail.info?.name ?? getDefaultListName(source),
    list,
    unmatched: 0,
  }
}

const writeMusicList = async(params: ExternalImportParams, list: LX.Music.MusicInfo[], onProgress?: (progress: ExternalImportProgress) => void) => {
  const musicInfos = filterMusicList(list)
  if (!musicInfos.length) throw new Error('No matched music')

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

export const importExternalPlaylist = async(params: ExternalImportParams, onProgress?: (progress: ExternalImportProgress) => void): Promise<ExternalImportResult> => {
  let listName = params.listName || getDefaultListName(params.source)
  let list: LX.Music.MusicInfo[]
  let total: number
  let unmatched = 0

  if (params.source == 'spotify') {
    const spotifyResult = await fetchSpotifyTracks(params, onProgress)
    listName = params.listName || spotifyResult.listName
    const matchedResult = await matchSpotifyTracks(spotifyResult.tracks, onProgress)
    list = matchedResult.list
    total = spotifyResult.tracks.length
    unmatched = matchedResult.unmatched
  } else {
    const nativeResult = await fetchNativeList(params)
    listName = params.listName || nativeResult.listName
    list = nativeResult.list
    total = nativeResult.list.length
    unmatched = nativeResult.unmatched
  }

  const imported = await writeMusicList({
    ...params,
    listName,
  }, list, onProgress)

  return {
    total,
    imported,
    unmatched,
    listName,
  }
}
