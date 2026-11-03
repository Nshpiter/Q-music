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
    if (!(data.hasmore === true || data.hasmore === 1 || data.hasmore === '1')) return rows
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
