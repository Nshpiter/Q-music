export interface KugouFavoriteRequest {
  hash: string
  name: string
  albumId?: string | number
  playlistId?: string
  action?: 'add' | 'check' | 'verify'
}

export interface KugouFavoriteResult {
  status: 'added' | 'login_required' | 'unsupported' | 'unavailable' | 'rejected' | 'unknown' | 'unconfirmed' | 'not_found' | 'account_changed' | 'verification_required' | 'verification_pending' | 'verification_cancelled' | 'verification_failed' | 'verification_unsupported' | 'verification_expired'
  code?: number
}

export interface KugouFavoriteTransport {
  ownerId?: string
  assertSession: () => Promise<void>
  getFavorites: () => Promise<Array<{ id: string, isFavorite?: boolean, writable?: boolean }>>
  getHashes: (id: string) => Promise<string[]>
  addSong: (id: string, song: KugouFavoriteRequest) => Promise<void>
  verifySession?: () => Promise<void>
}

// 两端只提供凭证和传输层；目标定位、重复提交保护和结果核对保持一致。
export const createKugouFavoriteClient = (open: () => Promise<KugouFavoriteTransport>, wait = async(ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms) })) => {
  const pending = new Map<string, Promise<KugouFavoriteResult>>()
  const perform = async(input: KugouFavoriteRequest): Promise<KugouFavoriteResult> => {
    let writing = false
    let verifying = false
    try {
      const transport = await open()
      const scoped = /^account:(\d+):(\d+)$/.exec(input.playlistId ?? '')
      if (scoped && scoped[1] != transport.ownerId) return { status: 'account_changed' }
      const targetId = scoped?.[2] ?? input.playlistId
      if (input.action == 'verify') {
        await transport.assertSession()
        if (!transport.verifySession) return { status: 'verification_unsupported' }
        await transport.verifySession()
        await transport.assertSession()
      }
      const checked = async<T>(request: () => Promise<T>): Promise<T> => {
        await transport.assertSession()
        const result = await request()
        await transport.assertSession()
        return result
      }
      const lists = await checked(transport.getFavorites)
      // 我喜欢由官方 is_def=2 标识，不能误写默认收藏、同名歌单或收藏他人的歌单。
      const favorites = lists.filter(list => targetId ? list.id == targetId && list.writable === true : list.isFavorite)
      if (favorites.length != 1 || !/^[1-9]\d*$/.test(favorites[0].id)) return { status: input.playlistId ? 'unsupported' : 'unavailable' }
      const id = favorites[0].id
      const check = async() => (await checked(async() => transport.getHashes(id))).some(hash => hash.toUpperCase() == input.hash)
      if (await check()) return { status: 'added' }
      if (input.action == 'check' || input.action == 'verify') return { status: 'not_found' }
      // 在发送前再次检查账号；任何不确定结果只允许回查，不自动换接口重写。
      await transport.assertSession()
      writing = true
      await transport.addSong(id, input)
      await transport.assertSession()
      verifying = true
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await wait(attempt * 1000)
        if (await check()) return { status: 'added' }
      }
      return { status: 'unconfirmed' }
    } catch (error) {
      const reason = error instanceof Error ? error.message : ''
      if (reason == 'login_required' || reason == 'account_changed') return { status: reason }
      const code = Number((error as { code?: number })?.code)
      if (reason == 'verification_required') return { status: writing || input.action == 'check' ? 'verification_pending' : 'verification_required', code: 20028 }
      if (['verification_cancelled', 'verification_failed', 'verification_unsupported', 'verification_expired'].includes(reason)) return { status: reason as KugouFavoriteResult['status'] }
      if (input.action == 'verify') return { status: 'verification_failed' }
      return { status: writing ? !verifying && Number.isFinite(code) ? 'rejected' : 'unknown' : 'unavailable', ...(Number.isFinite(code) ? { code } : {}) }
    }
  }
  return async(input: KugouFavoriteRequest): Promise<KugouFavoriteResult> => {
    const validId = (id: unknown) => id == null || (/^\d{1,16}$/.test(String(id)) && Number.isSafeInteger(Number(id)))
    if (typeof input?.hash != 'string' || !/^[a-f0-9]{32}$/i.test(input.hash) || typeof input.name != 'string' || !input.name.trim() || input.name.length > 512 ||
      !validId(input.albumId) || (input.playlistId != null && (typeof input.playlistId != 'string' || !/^(?:account:[1-9]\d{0,15}:)?[1-9]\d{0,15}$/.test(input.playlistId))) || (input.action != null && !['add', 'check', 'verify'].includes(input.action))) return { status: 'unsupported' }
    const song = { ...input, hash: input.hash.toUpperCase(), name: input.name.trim() }
    const key = `${song.hash}:${song.playlistId ?? 'favorite'}`
    const existing = pending.get(key)
    if (existing) return existing
    const task = perform(song).finally(() => { pending.delete(key) })
    pending.set(key, task)
    return task
  }
}
