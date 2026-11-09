type Call = (name: string, module: string, method: string, param: Record<string, unknown>) => Promise<Record<string, any>>

// 目标只需要账号自建歌单；不依赖收藏他人歌单、喜欢列表详情或公开主页。
const getOwnedRows = async(uin: string, call: Call) => {
  const rows: Array<Record<string, any>> = []
  const seen = new Set<string>()
  let offset = 0
  for (let page = 0; page < 100; page++) {
    const data = await call('targets', 'music.musicasset.PlaylistBaseRead', 'GetPlaylistByUin', { uin, offset, size: 100 })
    if (!Array.isArray(data.v_playlist)) throw new Error('unavailable')
    for (const item of data.v_playlist as Array<Record<string, any>>) {
      const dir = String(item.dirId ?? item.dirid ?? '')
      if (!/^[1-9]\d*$/.test(dir)) continue
      if (seen.has(dir)) throw new Error('incomplete')
      seen.add(dir)
      rows.push(item)
    }
    if (!(data.hasmore === true || data.hasmore === 1 || data.hasmore === '1') && data.bFinish !== false && data.bFinish !== 0) return rows
    if (!data.v_playlist.length) throw new Error('incomplete')
    offset += data.v_playlist.length
  }
  throw new Error('incomplete')
}

export const getQQPlaylistTargets = async(uin: string, call: Call) => (await getOwnedRows(uin, call)).map(item => ({
  id: 'dir:' + String(item.dirId ?? item.dirid),
  name: String(item.dirName ?? item.dirname ?? item.title ?? item.dissname ?? item.name ?? '').trim(),
  cover: String(item.picUrl ?? item.picurl ?? item.logo ?? ''),
  count: Number(item.songNum ?? item.song_cnt ?? item.songnum ?? 0),
  kind: 'created' as const,
})).filter(item => item.id != 'dir:201' && item.name)

export const isQQPlaylistId = (id: unknown): id is string => typeof id == 'string' && /^(?:dir:)?[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id.replace('dir:', '')))

// 写接口使用账号内 dirId，不能把公开 dissId 当作 dirId，也不能信任界面缓存的所有权。
export const resolveQQPlaylistTarget = async(id: string, uin: string, call: Call) => {
  const rows = await getOwnedRows(uin, call)
  const matches = rows.filter(item => {
    const dir = String(item.dirId ?? item.dirid ?? '')
    const publicIds = [item.tid, item.dissid, item.dissId, item.id].map(String)
    return id.startsWith('dir:') ? id == `dir:${dir}` : publicIds.includes(id)
  })
  if (matches.length != 1) throw new Error('unsupported')
  const item = matches[0]
  const dirId = Number(item.dirId ?? item.dirid)
  if (!Number.isSafeInteger(dirId) || dirId <= 0) throw new Error('unsupported')
  const dissId = [item.tid, item.dissid, item.dissId, item.id].map(Number).find(value => Number.isSafeInteger(value) && value > 0) ?? 0
  return { dirId, dissId }
}

// 本地继续用 dir:201 标识同账号的「我喜欢」，请求时使用列表返回的真实歌单 ID。
// 目录 ID 不能当成公开歌单 ID，读取也不再强制依赖旧主页的 encrypt_uin。
export const resolveQQPlaylistReadTarget = async(id: string, uin: string, call: Call) => {
  if (!isQQPlaylistId(id)) throw new Error('unavailable')
  if (!id.startsWith('dir:')) return { dirId: 0, dissId: Number(id) }
  const dirId = Number(id.slice(4))
  const rows = await getOwnedRows(uin, call)
  const row = rows.find(item => Number(item.dirId ?? item.dirid) == dirId)
  const dissId = row ? [row.tid, row.dissid, row.dissId, row.id].map(Number).find(value => Number.isSafeInteger(value) && value > 0) ?? 0 : 0
  const count = Number(row?.songNum ?? row?.song_cnt ?? row?.songnum)
  return { dirId, dissId, count: Number.isSafeInteger(count) && count >= 0 ? count : undefined }
}

const readFailure = (code: unknown): never => {
  throw Object.assign(new Error([301, 401, 403, 1000, 104400, 104401].includes(Number(code)) ? 'login_required' : 'unavailable'), { platformCode: Number(code) })
}

export const getQQPlaylistReadPage = async(target: { dirId: number, dissId: number, count?: number }, encryptedUin: string, offset: number, call: Call) => {
  if (!target.dissId && !encryptedUin) throw new Error('unavailable')
  const param = {
    disstid: target.dissId,
    dirid: target.dissId ? 0 : target.dirId,
    tag: true,
    userinfo: true,
    orderlist: true,
    song_begin: offset,
    song_num: 100,
    ...(!target.dissId && encryptedUin ? { enc_host_uin: encryptedUin } : {}),
  }
  const read = async(modern: boolean) => {
    const data = await call('detail', modern ? 'music.srfDissInfo.aiDissInfo' : 'music.srfDissInfo.DissInfo', modern ? 'uniform_get_Dissinfo' : 'CgiGetDiss', modern ? { ...param, tag: 1, userinfo: 1, orderlist: 1 } : param)
    if (data.code != null && Number(data.code) != 0) readFailure(data.code)
    const songs = data.songlist ?? data.songList ?? data.track_list
    if (!Array.isArray(songs)) throw new Error('incomplete')
    // 刚查到非空目录却拿到空歌曲响应时，不把权限/接口异常当作清空本地歌单。
    if (offset == 0 && target.count != null && target.count > 0 && !songs.length) throw new Error('incomplete')
    return data
  }
  if (!target.dissId) return read(false)
  try { return await read(true) } catch (error) {
    const reason = error instanceof Error ? ('reason' in error ? error.reason : error.message) : ''
    // 仅对接口不可用做兼容回退；掉登录、取消、换号和残缺数据不换路径冒充成功。
    if (reason != 'unavailable') throw error
    return read(false)
  }
}

export const checkQQPlaylistSong = async(target: { dirId: number, dissId: number }, songMid: string, encryptedUin: string, call: Call): Promise<boolean> => {
  if (!target.dissId && !encryptedUin) throw new Error('unavailable')
  let offset = 0
  for (let page = 0; page < 1000; page++) {
    const data = await call('verifyPlaylist', 'music.srfDissInfo.DissInfo', 'CgiGetDiss', {
      disstid: target.dissId,
      dirid: target.dissId ? 0 : target.dirId,
      tag: true,
      song_begin: offset,
      song_num: 100,
      userinfo: true,
      orderlist: true,
      ...(encryptedUin ? { enc_host_uin: encryptedUin } : {}),
    })
    const songs = data.songlist ?? data.songList ?? data.track_list
    if (!Array.isArray(songs)) throw new Error('unavailable')
    const ids = songs.map(item => {
      const song = item.track_info ?? item
      return String(song.mid ?? song.songmid ?? song.songMid ?? song.song_mid ?? '')
    })
    if (ids.some(id => !/^[a-zA-Z0-9]{1,64}$/.test(id))) throw new Error('unavailable')
    if (ids.includes(songMid)) return true
    offset += ids.length
    const total = Number(data.total_song_num ?? data.songnum ?? data.totalnum)
    if (!Number.isSafeInteger(total) || total < offset) throw new Error('unavailable')
    if (offset == total) return false
    if (!ids.length) throw new Error('unavailable')
  }
  throw new Error('unavailable')
}
