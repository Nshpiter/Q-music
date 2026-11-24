// 插件的数字歌曲 ID 只用于网易云公开歌词接口，平台登录凭证留在账号模块。
const cached = new Map()
const pending = new Map()
export async function publicLyrics(id, fetch) {
  const key = String(id)
  if (!/^[1-9]\d{0,17}$/.test(key)) throw Error('invalid_song_id')
  const hit = cached.get(key)
  if (hit && Date.now() < hit.expires) return hit.value
  if (pending.has(key)) return pending.get(key)
  if (pending.size >= 8) throw Error('lyrics_busy')
  const job = (async() => {
    const address = new URL('https://music.163.com/api/song/lyric')
    address.search = new URLSearchParams({ id: key, lv: '-1', tv: '-1', rv: '-1', kv: '-1', yv: '-1' }).toString()
    const response = await fetch(address.href, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw Error('lyrics_unavailable')
    const data = await response.json()
    if (data?.code !== 200) throw Error('lyrics_unavailable')
    const value = { code: 200, nolyric: data.nolyric === true, uncollected: data.uncollected === true }
    for (const field of ['lrc', 'tlyric', 'romalrc', 'yrc', 'ytlrc', 'yromalrc', 'klyric']) {
      if (typeof data[field]?.lyric === 'string') value[field] = { lyric: data[field].lyric, version: Number(data[field].version) || 0 }
    }
    if (cached.size >= 64) cached.delete(cached.keys().next().value)
    cached.set(key, { value, expires: Date.now() + 5 * 60 * 1000 })
    return value
  })()
  pending.set(key, job)
  try { return await job } finally { pending.delete(key) }
}
