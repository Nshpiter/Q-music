import { assertAccountSession, openAccountSession, request, type AccountSession } from './requests'
import { getQQCredentials, getQQRequestComm, getQQSyncIdentity, getQQWebRequestComm } from './qqCredentials'
import { zzcSign } from '@/utils/musicSdk/tx/utils/crypto'
import type { QQFavoriteRequest, QQFavoriteResult } from '@/types/qqFavorite'
import { isQQPlaylistId, resolveQQPlaylistTarget, checkQQPlaylistSong } from '@/utils/qqPlaylistTarget'
import { openPlaylistSession } from './playlists'

class FavoriteResponseError extends Error {
  constructor(public code: number) { super('rejected') }
}
const requireSuccess = (value: unknown) => {
  if (typeof value != 'number' && (typeof value != 'string' || !/^-?\d+$/.test(value))) throw new Error('unavailable')
  const code = Number(value)
  if (!Number.isSafeInteger(code)) throw new Error('unavailable')
  if (code != 0) throw new FavoriteResponseError(code)
}
const call = async(session: AccountSession, name: string, module: string, method: string, param: object, write = false) => {
  await assertAccountSession(session)
  const body = JSON.stringify({ comm: write ? getQQWebRequestComm(session.cookies) : getQQRequestComm(session.cookies), [name]: { module, method, param } })
  const url = write ? `https://u.y.qq.com/cgi-bin/musics.fcg?sign=${await zzcSign(body)}` : 'https://u.y.qq.com/cgi-bin/musicu.fcg'
  const result = await request(url, session.cookies, {
    method: 'POST',
    headers: { 'Content-Type': write ? 'application/x-www-form-urlencoded;charset=UTF-8' : 'application/json;charset=UTF-8', Origin: 'https://y.qq.com', Referer: 'https://y.qq.com/' },
    body,
  })
  await assertAccountSession(session)
  requireSuccess(result.code)
  requireSuccess(result[name]?.code)
  const data = result[name]?.data
  if (!data || typeof data != 'object') throw new Error('unavailable')
  if (data.retCode != null) requireSuccess(data.retCode)
  return data
}
const checkFavorite = async(session: AccountSession, songMid: string) => {
  const data = await call(session, 'verify', 'music.musicasset.SongFavRead', 'IsSongFanByMid', { v_songMid: [songMid] })
  const value: unknown = data.m_fan?.[songMid]
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  throw new Error('unavailable')
}
const perform = async(input: QQFavoriteRequest): Promise<QQFavoriteResult> => {
  let writing = false
  let verifying = false
  try {
    const session = await openAccountSession('tx')
    const success = (): QQFavoriteResult => ({ status: 'added', owner: getQQCredentials(session.cookies).uin, accountId: getQQSyncIdentity(session.cookies) })
    const read = async(name: string, module: string, method: string, param: Record<string, unknown>) => call(session, name, module, method, param)
    const target = input.playlistId ? await resolveQQPlaylistTarget(input.playlistId, getQQCredentials(session.cookies).uin, read) : { dirId: 201, dissId: 0 }
    const encryptedUin = input.playlistId && !target.dissId && target.dirId != 201 ? (await openPlaylistSession('tx')).encryptedUin : ''
    const check = async() => target.dirId == 201 ? checkFavorite(session, input.songMid) : checkQQPlaylistSong(target, input.songMid, encryptedUin, read)
    if (await check()) return success()
    if (input.action == 'check') return { status: 'not_found' }
    const data = await call(session, 'detail', 'music.pf_song_detail_svr', 'get_song_detail_yqq', { song_mid: input.songMid, song_type: 0 })
    const track = data.track_info
    if (track?.mid != input.songMid || !Number.isSafeInteger(track.id) || track.id <= 0 || (track.type != null && track.type != 0)) return { status: 'unsupported' }
    await assertAccountSession(session)
    writing = true
    await call(session, 'favorite', 'music.musicasset.PlaylistDetailWrite', 'AddSonglist', { dirId: target.dirId, v_songInfo: [{ songId: track.id, songType: 0 }] }, true)
    verifying = true
    // 写入只发送一次；短暂等待后只读回查，不能凭 code:0 宣称已收藏。
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await new Promise<void>(resolve => { setTimeout(resolve, 800) })
      if (await check()) return success()
    }
    return { status: 'unconfirmed' }
  } catch (error) {
    if (error instanceof Error && error.message == 'account_changed') return { status: 'account_changed' }
    if (error instanceof Error && error.message == 'login_required') return { status: 'login_required' }
    if (error instanceof Error && error.message == 'unsupported') return { status: 'unsupported' }
    if (error instanceof FavoriteResponseError) {
      if (verifying) return { status: 'unknown', code: error.code }
      if ([301, 401, 403, 1000, 104400, 104401].includes(error.code)) return { status: 'login_required', code: error.code }
      return { status: writing ? 'rejected' : 'unavailable', code: error.code }
    }
    return { status: writing ? 'unknown' : 'unavailable' }
  }
}

const pending = new Map<string, Promise<QQFavoriteResult>>()
export const addQQFavoriteSong = async(input: QQFavoriteRequest): Promise<QQFavoriteResult> => {
  if (!/^[a-zA-Z0-9]{1,64}$/.test(input.songMid) || (input.playlistId != null && !isQQPlaylistId(input.playlistId)) || (input.action != null && input.action != 'add' && input.action != 'check')) return { status: 'unsupported' }
  const key = `${input.songMid}:${input.playlistId ?? 'favorite'}`
  const existing = pending.get(key)
  if (existing) return existing
  const task = perform(input).finally(() => { pending.delete(key) })
  pending.set(key, task)
  return task
}
