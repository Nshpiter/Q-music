export interface HoyoAlbum { id: string, name: string, artist: string, date: string, image: string }
export function recentHoyoAlbums(body: { data?: Array<Record<string, unknown>> }, now = Date.now()): HoyoAlbum[] {
  if (!Array.isArray(body?.data)) throw Error('invalid_album_list')
  const seen = new Set<string>()
  const albums: HoyoAlbum[] = []
  for (const row of body.data) {
    const date = String(row?.publish_time ?? '').slice(0, 10)
    const time = Date.parse(date + 'T00:00:00+08:00')
    const id = String(row?.albumid ?? '')
    if (!/^\d+$/.test(id) || seen.has(id) || !row.albumname || !Number.isFinite(time) || time > now || now - time >= 7 * 86400000) continue
    seen.add(id)
    const img = String(row.img ?? '').replace(/^http:/, 'https:').replace('{size}', '240')
    albums.push({ id, date, name: String(row.albumname), artist: String(row.singername ?? 'HOYO-MiX'), image: /^https:\/\/[\w.-]+\.kugou\.com\//i.test(img) ? img : '' })
  }
  return albums.sort((a, b) => b.date.localeCompare(a.date))
}
