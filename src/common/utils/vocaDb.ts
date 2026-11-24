interface Entry {
  id: number
  name: string
  artistString: string
  artists: Array<{ id: number, name: string, role: string }>
  songType: string
  publishDate: string
  videos: Array<{ name: string, url: string }>
}

// 只接受 VocaDB 支持的公开作品链接，链接用各站的作品号生成。
const videoLink = (service: string, id: string) => {
  if (service === 'Bilibili' && /^(?:BV[0-9A-Za-z]{10}|av\d+)$/.test(id)) return 'https://www.bilibili.com/video/' + id
  if (service === 'Youtube' && /^[\w-]{11}$/.test(id)) return 'https://www.youtube.com/watch?v=' + id
  if (service === 'NicoNicoDouga' && /^(?:sm|nm|so)?\d+$/.test(id)) return 'https://www.nicovideo.jp/watch/' + id
  return ''
}

export const queryVocaDb = async(title: string, singer: string, signal: AbortSignal, request = fetch): Promise<Entry[]> => {
  if (!title.trim()) return []
  const api = new URL('https://vocadb.net/api/songs')
  api.search = new URLSearchParams({
    query: title.trim(),
    nameMatchMode: 'Auto',
    sort: 'Name',
    fields: 'Names,PVs,Artists',
    lang: 'Default',
    maxResults: '12',
  }).toString()
  const response = await request(api, { signal, credentials: 'omit', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('VocaDB HTTP ' + response.status)
  const data = await response.json()
  if (!Array.isArray(data.items)) throw new Error('invalid_song_list')
  const normalize = (text: string) => text.normalize('NFKC').toLowerCase().trim()
  const name = normalize(title)
  const requestedArtists = singer.split('、').map(normalize).filter(Boolean)
  return data.items.filter((row: any) => Number.isSafeInteger(row?.id) && row.id > 0 && typeof row.name === 'string').map((row: any) => {
    const artistString = String(row.artistString || '')
    const exact = [row.name, ...(row.names || []).map((alias: { value?: string }) => alias.value)].some(value => typeof value === 'string' && normalize(value) === name)
    const score = (exact ? 2 : 0) + (requestedArtists.some(artist => normalize(artistString).includes(artist)) ? 1 : 0)
    const videos: Entry['videos'] = []
    for (const pv of row.pvs || []) {
      if (pv?.pvType !== 'Original' || pv.disabled) continue
      const url = videoLink(pv.service, String(pv.pvId))
      if (url && !videos.some(item => item.url === url)) videos.push({ name: pv.service, url })
    }
    const artists: Entry['artists'] = []
    for (const credit of row.artists || []) {
      const artist = credit?.artist
      if (!Number.isSafeInteger(artist?.id) || artist.id <= 0 || !artist.name || artists.some(a => a.id === artist.id)) continue
      artists.push({ id: artist.id, name: String(artist.name), role: String(credit.effectiveRoles || credit.roles || '') })
    }
    return { score, entry: { id: row.id, name: row.name, artistString, artists, songType: String(row.songType || ''), publishDate: String(row.publishDate || '').slice(0, 10), videos } }
  }).sort((a: { score: number }, b: { score: number }) => b.score - a.score).map((item: { entry: Entry }) => item.entry)
}
