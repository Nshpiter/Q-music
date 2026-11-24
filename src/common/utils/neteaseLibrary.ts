import { formatPlayTime2 } from './common'

interface CloudSong {
  songId?: number | string
  songName?: string
  fileName?: string
  album?: string
  artist?: string
  simpleSong?: { id?: number, name?: string, dt?: number, ar?: Array<{ name: string }>, al?: { id?: number, name?: string, picUrl?: string } }
}
export interface CloudPage { data: CloudSong[], count?: number, hasMore?: boolean }
export const loadNeteaseCloudSongs = async(page: (offset: number, limit: number) => Promise<CloudPage>) => {
  const songs = new Map<string, LX.Music.MusicInfoOnline>()
  let offset = 0
  for (;;) {
    const batch = await page(offset, 200)
    if (!Array.isArray(batch.data)) throw Error('cloud_incomplete')
    const size = songs.size
    for (const entry of batch.data) {
      const song = entry.simpleSong
      const id = String(entry.songId ?? song?.id ?? '')
      if (!/^\d+$/.test(id)) continue
      songs.set(id, {
        source: 'wy',
        id: 'wy_' + id,
        name: [entry.songName, song?.name, entry.fileName, id].find(Boolean)!,
        singer: [entry.artist, song?.ar?.map(artist => artist.name).join('、')].find(Boolean) ?? '',
        interval: song?.dt ? formatPlayTime2(song.dt / 1000) : null,
        meta: { songId: id, albumName: [entry.album, song?.al?.name].find(Boolean) ?? '', albumId: song?.al?.id, picUrl: song?.al?.picUrl, qualitys: [], _qualitys: {} },
      })
    }
    offset += batch.data.length
    if (batch.data.length && songs.size == size) throw Error('cloud_incomplete')
    if (batch.hasMore === false && batch.count != null && songs.size < batch.count) throw Error('cloud_incomplete')
    if (batch.hasMore === false || (batch.count != null && songs.size >= batch.count) || (batch.hasMore == null && batch.count == null && batch.data.length < 200)) break
    if (!batch.data.length) throw Error('cloud_incomplete')
  }
  return [...songs.values()]
}

interface CommentAuthor { userId: string | number, reply?: CommentAuthor[] }
export const visibleComments = <T extends CommentAuthor>(list: T[], blocked: Set<string>): T[] => {
  if (!blocked.size) return list
  return list.filter(comment => !blocked.has(String(comment.userId)) && !comment.reply?.some(reply => blocked.has(String(reply.userId))))
}
