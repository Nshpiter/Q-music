import { getQQCredentials } from './cookies'
import { getQQAccountCatalog } from '@/utils/qqAccountCatalog'
import { resolveQQPlaylistReadTarget, getQQPlaylistReadPage } from '@/utils/qqPlaylistTarget'
import { request, qqRequest, wyRequest, fail, checkCode, openAccountSession, assertAccountSession } from './requests'
import type { MusicAccountProvider } from './types'
import qqSongList from '@/utils/musicSdk/tx/songList'
import wySongList from '@/utils/musicSdk/wy/songList'
import { toNewMusicInfo } from '@/utils'
import kgSongList from '@/utils/musicSdk/kg/songList'
import { assertKugouSession, kugouApi, requireKugouSession } from './kugou'
import type { KugouSession } from './kugouApi'

export interface AccountPlaylist {
  writable?: boolean
  id: string
  name: string
  cover: string
  count: number
  kind: 'created' | 'favorite'
}
export interface PlaylistSession {
  kugou?: KugouSession
  provider: MusicAccountProvider
  owner: string
  encryptedUin: string
  catalogPartial?: boolean
  cookies: Record<string, string>
}
type Row = Record<string, any>
const MAX_PAGES = 1000
const more = (value: unknown) => value === true || value === 1 || value === '1'
export const openPlaylistSession = async(provider: MusicAccountProvider, signal?: AbortSignal): Promise<PlaylistSession> => {
  if (provider == 'kg') {
    const kugou = await requireKugouSession()
    return { provider, owner: kugou.userId, cookies: {}, encryptedUin: '', kugou }
  }
  const { cookies } = await openAccountSession(provider)
  const session: PlaylistSession = { provider, cookies, owner: '', encryptedUin: '' }
  if (provider == 'tx') {
    session.owner = getQQCredentials(cookies).uin
    try {
      const result = await request(`https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?ct=20&cv=4747474&cid=205360838&userid=${session.owner}`, cookies, {
        headers: { Referer: 'https://y.qq.com/' },
      }, signal)
      checkCode(result.code, 0)
      session.encryptedUin = String(result.data?.creator?.encrypt_uin ?? '')
    } catch (error) {
      if (signal?.aborted === true || (error instanceof Error && ['login_required', 'account_changed', 'cancelled'].includes(error.message))) throw error
      // 公开主页失败不等于登录失效，自建歌单仍使用音乐账号接口读取。
    }
  } else {
    const result = await wyRequest(session, 'w/nuser/account/get', {}, signal)
    session.owner = String(result.profile?.userId ?? result.account?.id ?? '')
    if (!/^\d+$/.test(session.owner)) fail('login_required')
  }
  return session
}

export const assertPlaylistSession = async(session: PlaylistSession) => {
  if (session.provider == 'kg') {
    if (!session.kugou) fail('login_required')
    await assertKugouSession(session.kugou!)
  } else await assertAccountSession(session)
}

const unique = <T extends { id: string }>(items: T[]): T[] => [...new Map(items.map(item => [item.id, item])).values()]
const coverUrl = (value: unknown): string => {
  const url = String(value ?? '')
  return url.startsWith('//') ? `https:${url}` : /^https?:\/\//.test(url) ? url : ''
}
const qqPlaylist = (item: Row, kind: AccountPlaylist['kind']): AccountPlaylist => {
  const dir = String(item.dirId ?? item.dirid ?? '')
  const id = [item.tid, item.dissid, item.dissId, item.id].map(value => String(value ?? '')).find(value => /^\d+$/.test(value) && value != '0')
  return {
    id: dir == '201' ? 'dir:201' : id ?? (dir ? `dir:${dir}` : ''),
    name: String(item.dirName ?? item.dirname ?? item.title ?? item.dissname ?? item.name ?? ''),
    cover: coverUrl(item.picUrl ?? item.bigpicUrl ?? item.picurl ?? item.logo),
    count: Number(item.songNum ?? item.song_cnt ?? item.songnum ?? item.song_num ?? item.songCount ?? item.trackCount ?? 0),
    kind,
  }
}

export const getAccountPlaylists = async(session: PlaylistSession, signal?: AbortSignal): Promise<AccountPlaylist[]> => {
  if (session.provider == 'kg') {
    if (!session.kugou) fail('login_required')
    const lists = await kugouApi.getPlaylists(session.kugou!, signal)
    await assertPlaylistSession(session)
    if (signal?.aborted) fail('cancelled')
    return lists
  }
  const lists: AccountPlaylist[] = []
  if (session.provider == 'wy') {
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await wyRequest(session, 'user/playlist', { uid: session.owner, offset: lists.length, limit: 100, includeVideo: false }, signal)
      if (!Array.isArray(result.playlist)) fail()
      const rows: Row[] = result.playlist
      lists.push(...rows.map(item => ({ id: String(item.id), name: String(item.name ?? ''), cover: coverUrl(item.coverImgUrl), count: Number(item.trackCount ?? 0), kind: String(item.creator?.userId) == session.owner ? 'created' as const : 'favorite' as const })))
      if (!more(result.more)) return unique(lists)
      if (!rows.length) fail('incomplete')
    }
  } else {
    const catalog = await getQQAccountCatalog(session.owner, session.encryptedUin, async(name, module, method, param) => {
      if (signal?.aborted) fail('cancelled')
      return (await qqRequest(session, { [name]: { module, method, param } }, signal))[name].data
    })
    await assertPlaylistSession(session)
    session.catalogPartial = catalog.warnings.length > 0
    return unique([
      ...catalog.created.map(item => qqPlaylist(item, 'created')),
      ...catalog.favorite.map(item => qqPlaylist(item, 'favorite')),
    ].filter(item => item.id && item.name))
  }
  return fail('incomplete')
}

export const getAccountPlaylistTracks = async(session: PlaylistSession, id: string, signal?: AbortSignal, progress?: (current: number, total: number) => void): Promise<LX.Music.MusicInfoOnline[]> => {
  if (!/^(?:dir:)?\d+$/.test(id)) fail()
  const tracks: LX.Music.MusicInfoOnline[] = []
  if (session.provider == 'kg') {
    if (!session.kugou) fail('login_required')
    const hashes = await kugouApi.getPlaylistHashes(session.kugou!, id, signal)
    for (let offset = 0; offset < hashes.length; offset += 100) {
      if (signal?.aborted) fail('cancelled')
      const group = hashes.slice(offset, offset + 100)
      const details = await kgSongList.getMusicInfos(group.map(hash => ({ hash })), { requireComplete: true, shouldCancel: () => !!signal?.aborted })
      tracks.push(...details.map((item: unknown) => toNewMusicInfo(item) as LX.Music.MusicInfoOnline))
      progress?.(tracks.length, hashes.length)
    }
    await assertPlaylistSession(session)
    return tracks
  }
  if (session.provider == 'wy') {
    const result = await wyRequest(session, 'v6/playlist/detail', { id, n: 100000, s: 0 }, signal)
    const playlist = result.playlist
    if (!Array.isArray(playlist?.trackIds)) fail()
    const trackIds: Row[] = playlist.trackIds
    const ids = [...new Set(trackIds.map(item => String(item.id)))]
    if (ids.some(songId => !/^\d+$/.test(songId))) fail('incomplete')
    if (playlist.trackCount != null && Number(playlist.trackCount) != ids.length) fail('incomplete')
    for (let offset = 0; offset < ids.length; offset += 200) {
      const batch = ids.slice(offset, offset + 200)
      const detail = await wyRequest(session, 'v3/song/detail', { c: JSON.stringify(batch.map(songId => ({ id: songId }))) }, signal)
      if (!Array.isArray(detail.songs) || !Array.isArray(detail.privileges)) fail('incomplete')
      const songs: Row[] = batch.map(songId => detail.songs.find((song: Row) => String(song.id) == songId) ?? fail('incomplete'))
      // 权限和歌曲必须按 ID 对齐，不能将缺失权限静默当成空歌单。
      const privileges = songs.map(song => detail.privileges.find((item: Row) => String(item.id) == String(song.id)) ?? fail('incomplete'))
      tracks.push(...wySongList.filterListDetail({ playlist: { tracks: songs }, privileges }).map((song: unknown) => toNewMusicInfo(song) as LX.Music.MusicInfoOnline))
      progress?.(tracks.length, ids.length)
    }
    if (tracks.length != ids.length) fail('incomplete')
    return tracks
  }
  const read = async(name: string, module: string, method: string, param: Row) => {
    if (signal?.aborted) fail('cancelled')
    const key = name == 'targets' ? 'created' : name
    return (await qqRequest(session, { [key]: { module, method, param } }, signal))[key].data
  }
  const target = await resolveQQPlaylistReadTarget(id, session.owner, read)
  const seen = new Set<string>()
  let offset = 0
  let expected: number | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await getQQPlaylistReadPage(target, session.encryptedUin, offset, read)
    const rows: Row[] = data.songlist ?? data.songList ?? data.track_list
    if (!Array.isArray(rows)) fail()
    const rawTotal = data.total_song_num ?? data.songnum ?? data.totalnum
    if (rawTotal != null) {
      const total = Number(rawTotal)
      if (!Number.isFinite(total) || total < 0 || (expected != null && expected != total)) fail('incomplete')
      expected = total
    }
    const songs = rows.map(item => item.track_info ?? item)
    for (const song of songs) {
      if (!song.mid || !song.file || !song.album || seen.has(String(song.mid))) fail('incomplete')
      seen.add(String(song.mid))
    }
    const formatted: unknown[] = qqSongList.filterListDetail(songs)
    tracks.push(...formatted.map(song => toNewMusicInfo(song) as LX.Music.MusicInfoOnline))
    if (formatted.length != rows.length) fail('incomplete')
    offset += rows.length
    progress?.(tracks.length, expected ?? 0)
    if (expected != null && offset >= expected) {
      if (offset != expected || more(data.hasmore)) fail('incomplete')
      return tracks
    }
    const ended = data.hasmore != null && !more(data.hasmore)
    if (ended || rows.length == 0) {
      if ((expected != null && offset != expected) || (expected == null && !ended)) fail('incomplete')
      return tracks
    }
  }
  return fail('incomplete')
}
