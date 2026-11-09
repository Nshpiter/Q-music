type Row = Record<string, any>
type Call = (name: string, module: string, method: string, param: Row) => Promise<Row>
const more = (value: unknown) => value === true || value === 1 || value === '1'
const fail = (reason = 'unavailable'): never => { throw new Error(reason) }
const recoverable = (error: unknown) => {
  if (!(error instanceof Error) || error.name == 'AbortError') return false
  const reason = 'reason' in error ? error.reason : error.message
  return !['login_required', 'account_changed', 'cancelled', 'incomplete'].includes(String(reason))
}

// 各类歌单独立读取；缺失的一类不能遮住已读到的另一类，也不能冒充完整结果。
export const getQQAccountCatalog = async(uin: string, encryptedUin: string, call: Call) => {
  const created: Row[] = []
  const seen = new Set<string>()
  for (let page = 0; page < 100; page++) {
    const data = await call('created', 'music.musicasset.PlaylistBaseRead', 'GetPlaylistByUin', { uin, offset: created.length, size: 100 })
    if (!Array.isArray(data.v_playlist)) fail()
    for (const row of data.v_playlist as Row[]) {
      const id = String(row.dirId ?? row.dirid ?? row.tid ?? row.dissid ?? '')
      if (!id || seen.has(id)) fail('incomplete')
      seen.add(id)
      created.push(row)
    }
    if (!more(data.hasmore) && data.bFinish !== false && data.bFinish !== 0) break
    if (!data.v_playlist.length || page == 99) fail('incomplete')
  }

  const warnings: Array<'profile' | 'favorite' | 'liked'> = []
  let favorite: Row[] = []
  if (!encryptedUin) warnings.push('profile')
  else {
    try {
      const collected: Row[] = []
      const favoriteIds = new Set<string>()
      for (let page = 0; page < 100; page++) {
        const data = await call('favorite', 'music.musicasset.PlaylistFavRead', 'CgiGetPlaylistFavInfo', { uin: encryptedUin, offset: collected.length, size: 100 })
        // 只有平台明确声明空列表时，才允许省略数组。
        const rows = data.v_list ?? data.v_playlist ?? (!more(data.hasmore) && (Number(data.total) === 0 || Number(data.number) === 0) ? [] : undefined)
        if (!Array.isArray(rows)) fail()
        for (const row of rows as Row[]) {
          const id = String(row.tid ?? row.dissid ?? row.dissId ?? row.id ?? '')
          if (!id || favoriteIds.has(id)) fail('incomplete')
          favoriteIds.add(id)
          collected.push(row)
        }
        if (!more(data.hasmore)) { favorite = collected; break }
        if (!rows.length || page == 99) fail('incomplete')
      }
    } catch (error) {
      if (!recoverable(error)) throw error
      warnings.push('favorite')
    }
  }

  // 自建列表已经提供「我喜欢」及歌曲数，不再为了同一信息强制请求歌曲详情。
  if (!created.some(row => String(row.dirId ?? row.dirid) == '201')) {
    if (encryptedUin) {
      try {
        const data = await call('liked', 'music.srfDissInfo.DissInfo', 'CgiGetDiss', {
          disstid: 0, dirid: 201, tag: true, song_begin: 0, song_num: 1, userinfo: true, orderlist: true, enc_host_uin: encryptedUin,
        })
        if (data.code != null && Number(data.code) != 0) fail([301, 401, 403, 1000, 104400, 104401].includes(Number(data.code)) ? 'login_required' : 'unavailable')
        const count = Number(data.total_song_num ?? data.songnum ?? data.totalnum)
        if (!Number.isSafeInteger(count) || count < 0) fail()
        created.unshift({ dirId: 201, dirName: '我喜欢', songNum: count })
      } catch (error) {
        if (!recoverable(error)) throw error
        warnings.push('liked')
      }
    }
  }
  if (!created.length && !favorite.length && warnings.length) fail()
  return { created, favorite, warnings }
}
