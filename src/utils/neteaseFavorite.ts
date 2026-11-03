export interface NeteaseFavoriteRequest {
  songId: string
  playlistId?: string
  action?: 'add' | 'check'
}

export interface NeteaseFavoriteResult {
  status: 'added' | 'login_required' | 'unsupported' | 'unavailable' | 'rejected' | 'unknown' | 'unconfirmed' | 'not_found' | 'account_changed'
  code?: number
}

export interface NeteaseFavoriteTransport {
  assertSession: () => Promise<void>
  request: (path: string, data: Record<string, unknown>) => Promise<Record<string, any>>
}

class ResponseError extends Error {
  constructor(public code: number) { super('rejected') }
}

// PC 和安卓使用同一流程；仅传输层负责各自的凭证存储和网络请求。
export const createNeteaseFavoriteClient = (open: () => Promise<NeteaseFavoriteTransport>, wait = async(ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms) })) => {
  const pending = new Map<string, Promise<NeteaseFavoriteResult>>()
  const perform = async(input: NeteaseFavoriteRequest): Promise<NeteaseFavoriteResult> => {
    let writing = false
    let verifying = false
    try {
      const transport = await open()
      const call = async(path: string, data: Record<string, unknown>, accepted = [200]) => {
        await transport.assertSession()
        const result = await transport.request(path, data)
        await transport.assertSession()
        if (result.code == null || !/^-?\d+$/.test(String(result.code))) throw new Error('unavailable')
        if (!accepted.includes(Number(result.code))) throw new ResponseError(Number(result.code))
        return result
      }
      const profile = await call('w/nuser/account/get', {})
      const uid = String(profile.profile?.userId ?? profile.account?.id ?? '')
      if (!/^[1-9]\d*$/.test(uid)) throw new Error('login_required')
      // 默认定位官方喜欢歌单；指定歌单必须属于当前账号，禁止写入收藏的他人歌单。
      let playlistId = ''
      for (let page = 0; page < 20; page++) {
        const result = await call('user/playlist', { uid, limit: 100, offset: page * 100, includeVideo: false })
        if (!Array.isArray(result.playlist)) throw new Error('unavailable')
        const favorite = result.playlist.find(item => (input.playlistId ? String(item?.id) == input.playlistId : Number(item?.specialType) == 5) && String(item?.creator?.userId ?? item?.userId ?? '') == uid)
        if (favorite) {
          playlistId = String(favorite.id ?? '')
          break
        }
        if (!(result.more === true || result.more === 1 || result.more === '1') || !result.playlist.length) break
      }
      if (!/^[1-9]\d*$/.test(playlistId)) return { status: input.playlistId ? 'unsupported' : 'unavailable' }
      const check = async() => {
        const result = await call('v6/playlist/detail', { id: playlistId, n: 100000, s: 0, timestamp: Date.now() })
        const playlist = result.playlist
        if (String(playlist?.id ?? '') != playlistId || String(playlist?.creator?.userId ?? playlist?.userId ?? '') != uid) throw new Error('unavailable')
        const ids = playlist.trackIds
        if (!Array.isArray(ids) || !ids.every(item => /^[1-9]\d*$/.test(String(item?.id)))) throw new Error('unavailable')
        if (ids.some(item => String(item.id) == input.songId)) return true
        // 不完整的响应不能证明歌曲不存在，也不能触发再次写入。
        if (!Number.isSafeInteger(playlist.trackCount) || playlist.trackCount != ids.length) throw new Error('unavailable')
        return false
      }
      if (await check()) return { status: 'added' }
      if (input.action == 'check') return { status: 'not_found' }
      writing = true
      // 502 表示已经存在，仍必须回读确认；不在响应不明时换接口重复写入。
      await call('playlist/manipulate/tracks', { op: 'add', pid: playlistId, trackIds: JSON.stringify([input.songId]), imme: 'true' }, [200, 502])
      verifying = true
      // 只发送一次写请求；不确定时只读回查，不自动重试收藏。
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await wait(attempt * 1000)
        if (await check()) return { status: 'added' }
      }
      return { status: 'unconfirmed' }
    } catch (error) {
      if (error instanceof Error && error.message == 'account_changed') return { status: 'account_changed' }
      if (error instanceof Error && error.message == 'login_required') return { status: 'login_required' }
      if (error instanceof ResponseError) {
        if ([301, 401].includes(error.code)) return { status: 'login_required', code: error.code }
        return { status: verifying ? 'unknown' : writing ? 'rejected' : 'unavailable', code: error.code }
      }
      return { status: writing ? 'unknown' : 'unavailable' }
    }
  }
  return async(input: NeteaseFavoriteRequest): Promise<NeteaseFavoriteResult> => {
    if (typeof input?.songId != 'string' || !/^[1-9]\d{0,15}$/.test(input.songId) || !Number.isSafeInteger(Number(input.songId)) ||
      (input.playlistId != null && (typeof input.playlistId != 'string' || !/^[1-9]\d{0,15}$/.test(input.playlistId) || !Number.isSafeInteger(Number(input.playlistId)))) ||
      (input.action != null && input.action != 'add' && input.action != 'check')) return { status: 'unsupported' }
    // 同一歌曲的重复点击共用请求；切换账号会由 assertSession 拒绝。
    const key = `${input.songId}:${input.playlistId ?? 'favorite'}`
    const existing = pending.get(key)
    if (existing) return existing
    const task = perform(input).finally(() => { pending.delete(key) })
    pending.set(key, task)
    return task
  }
}
