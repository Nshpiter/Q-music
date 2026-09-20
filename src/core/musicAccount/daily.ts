import AsyncStorage from '@react-native-async-storage/async-storage'
import { NativeModules } from 'react-native'
import { getQQCredentials, getProviderCookies, isQQLoginCookieValid, isNeteaseLoginCookieValid } from './cookies'
import { assertAccountSession, openAccountSession, qqRequest, wyRequest, request, fail, type AccountSession } from './requests'
import type { MusicAccountProvider } from './types'
import qqSongList from '@/utils/musicSdk/tx/songList'
import wySongList from '@/utils/musicSdk/wy/songList'
import { toNewMusicInfo } from '@/utils'
import { getDailyRecommend } from '@/core/dailyRecommend'

export type DailyKind = 'official_daily' | 'radar' | 'netease_daily' | 'local'
export type DailyReason = 'login_required' | 'unavailable' | 'official_unavailable' | ''
export interface DailyRecommendation {
  provider: MusicAccountProvider
  kind: DailyKind
  reason: DailyReason
  list: LX.Music.MusicInfoOnline[]
}
const credentialStore = NativeModules.MusicCredentialModule as {
  getQQDailyKey: (owner: string) => Promise<string | null>
  setQQDailyKey: (owner: string, value: string) => Promise<void>
  clearQQDailyKey: () => Promise<void>
} | undefined
const PROVIDER_KEY = '@qmusic_daily_provider'
const cache = new Map<MusicAccountProvider, { identity: string, day: string, expires: number, value: DailyRecommendation }>()
const dayKey = () => new Date().toLocaleDateString('en-CA')
const aborted = (signal?: AbortSignal) => { if (signal?.aborted) fail('cancelled') }

export const getDailyProvider = async(): Promise<MusicAccountProvider> => {
  const saved = await AsyncStorage.getItem(PROVIDER_KEY).catch(() => null)
  if (saved == 'tx' || saved == 'wy') return saved
  const qq = await getProviderCookies('tx').catch(() => ({}))
  if (isQQLoginCookieValid(qq)) return 'tx'
  const wy = await getProviderCookies('wy').catch(() => ({}))
  return isNeteaseLoginCookieValid(wy) ? 'wy' : 'tx'
}
export const setDailyProvider = async(provider: MusicAccountProvider) => { await AsyncStorage.setItem(PROVIDER_KEY, provider) }
export const clearDailyCache = () => { cache.clear() }
export const clearQQDailyKey = async() => {
  await credentialStore?.clearQQDailyKey()
  clearDailyCache()
}
export const getQQDailyKeyStatus = async() => {
  const cookies = await getProviderCookies('tx')
  if (!credentialStore) return { configured: false, available: false }
  const owner = getQQCredentials(cookies).uin
  try { return { configured: !!owner && !!await credentialStore.getQQDailyKey(owner), available: true } } catch { return { configured: false, available: false } }
}

export const requestQQOfficialDailyIds = async(key: string, signal?: AbortSignal): Promise<string[]> => {
  const result = await request('https://a.y.qq.com/discover/daily-mix', {}, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ params: {}, comm: { skill_version: '0.0.3' } }),
  }, signal)
  if (result.ret != 0 || (result.sub_ret != null && result.sub_ret != 0) || !Array.isArray(result.songlist)) fail()
  const rows: Array<{ songMid?: string }> = result.songlist
  return [...new Set(rows.map(item => item.songMid ?? '').filter(id => /^[a-zA-Z0-9]+$/.test(id)))].slice(0, 30)
}
export const saveQQDailyKey = async(value: string, signal?: AbortSignal) => {
  const key = value.trim()
  if (!/^qmk-[A-Za-z0-9_-]{12,1024}$/.test(key)) fail('invalid_key')
  if (!credentialStore) fail('credential_storage')
  const session = await openAccountSession('tx')
  const ids = await requestQQOfficialDailyIds(key, signal)
  if (!ids.length) fail('invalid_key')
  await assertAccountSession(session)
  aborted(signal)
  await credentialStore!.setQQDailyKey(getQQCredentials(session.cookies).uin, key)
  clearDailyCache()
}

const qqTracks = async(session: AccountSession, ids: string[], signal?: AbortSignal) => {
  const tracks: LX.Music.MusicInfoOnline[] = []
  for (let offset = 0; offset < ids.length; offset += 6) {
    aborted(signal)
    const batch = await Promise.all(ids.slice(offset, offset + 6).map(async id => {
      try {
        const response = await qqRequest(session, { detail: { module: 'music.pf_song_detail_svr', method: 'get_song_detail_yqq', param: { song_type: 0, song_mid: id } } }, signal, 19)
        const track = response.detail.data.track_info
        if (!track?.mid || !track.file?.media_mid || !track.album) return null
        return toNewMusicInfo(qqSongList.filterListDetail([track])[0]) as LX.Music.MusicInfoOnline
      } catch { return null }
    }))
    tracks.push(...batch.filter((item): item is LX.Music.MusicInfoOnline => item != null))
  }
  aborted(signal)
  return tracks
}
const qqRadar = async(session: AccountSession, signal?: AbortSignal) => {
  const ids = new Set<string>()
  for (let page = 1; page <= 4 && ids.size < 30; page++) {
    const result = await qqRequest(session, { radio: { module: 'music.recommend.TrackRelationServer', method: 'GetRadarSong', param: { Page: page } } }, signal, 19)
    const data = result.radio.data
    const rows = [data.VecSongs, data.tracks, data.track, data.songList, data.vec_song, data.List].find(Array.isArray) as Array<Record<string, any>> | undefined
    if (!rows?.length) break
    for (const row of rows) {
      const track = row.Track ?? row.track_info ?? row
      const id = String(track.mid ?? track.songmid ?? '')
      if (/^[a-zA-Z0-9]+$/.test(id)) ids.add(id)
      if (ids.size == 30) break
    }
  }
  return qqTracks(session, [...ids], signal)
}
const neteaseDaily = async(session: AccountSession, signal?: AbortSignal) => {
  const result = await wyRequest(session, 'v3/discovery/recommend/songs', { offset: 0, total: true, limit: 30 }, signal)
  const rows: Array<{ id?: string | number }> = result.data?.dailySongs ?? []
  const ids = [...new Set(rows.map(item => String(item.id ?? '')).filter(id => /^\d+$/.test(id)))].slice(0, 30)
  if (!ids.length) return []
  const detail = await wyRequest(session, 'v3/song/detail', { c: JSON.stringify(ids.map(id => ({ id }))) }, signal)
  if (!Array.isArray(detail.songs) || !Array.isArray(detail.privileges)) fail()
  const songs = ids.map(id => detail.songs.find((song: { id: unknown }) => String(song.id) == id)).filter(Boolean)
  const privileges = songs.map(song => detail.privileges.find((item: { id: unknown }) => String(item.id) == String(song.id)) ?? { id: song.id, maxbr: 0 })
  return wySongList.filterListDetail({ playlist: { tracks: songs }, privileges }).map((song: unknown) => toNewMusicInfo(song) as LX.Music.MusicInfoOnline)
}

export const getAccountDaily = async(provider: MusicAccountProvider, force = false, signal?: AbortSignal): Promise<DailyRecommendation> => {
  let reason: DailyReason = 'unavailable'
  let session: AccountSession | undefined
  let identity = ''
  let key: string | null = null
  let result: DailyRecommendation | undefined
  try {
    session = await openAccountSession(provider)
    if (provider == 'tx') key = await credentialStore?.getQQDailyKey(getQQCredentials(session.cookies).uin).catch(() => null) ?? null
    identity = JSON.stringify([session.cookies, key])
    const previous = cache.get(provider)
    if (!force && previous?.identity == identity && previous.day == dayKey() && previous.expires > Date.now()) {
      await assertAccountSession(session)
      aborted(signal)
      return previous.value
    }
    if (provider == 'wy') {
      const list = await neteaseDaily(session, signal)
      if (list.length) result = { provider, kind: 'netease_daily', reason: '', list }
    } else {
      if (key) {
        try {
          const ids = await requestQQOfficialDailyIds(key, signal)
          const list = await qqTracks(session, ids, signal)
          if (list.length) result = { provider, kind: 'official_daily', reason: '', list }
        } catch {}
        if (!result) reason = 'official_unavailable'
      }
      aborted(signal)
      if (!result) {
        const list = await qqRadar(session, signal)
        if (list.length) result = { provider, kind: 'radar', reason: key ? 'official_unavailable' : '', list }
      }
    }
    await assertAccountSession(session)
  } catch (error) {
    result = undefined
    if (error instanceof Error && ['login_required', 'account_changed'].includes(error.message)) reason = 'login_required'
  }
  aborted(signal)
  if (!result) {
    // 与 PC 一致保留本地兜底，但返回明确标记，绝不冒充平台日推。
    const list = await getDailyRecommend(provider, force)
    aborted(signal)
    result = { provider, kind: 'local', reason, list }
  }
  if (identity && result.kind != 'local') cache.set(provider, { identity, day: dayKey(), expires: Date.now() + 10 * 60_000, value: result })
  return result
}
