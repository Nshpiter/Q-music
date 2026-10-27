import musicSdk from '@/utils/musicSdk'
import { httpFetch } from '@/utils/request'
import { toNewMusicInfo, formatPlayTime } from '@/utils'
import { signRequest } from '@/utils/musicSdk/tx/utils'
import { eapiRequest } from '@/utils/musicSdk/wy/utils'
import { getMusicInfosByList } from '@/utils/musicSdk/kg/musicInfo'

export type SongBrowseKind = 'artist' | 'album'
export interface SongBrowseResult { songs: LX.Music.MusicInfoOnline[], hasMore: boolean }
export class SongBrowseError extends Error {
  constructor(public reason: 'unavailable' | 'timeout' | 'cancelled' | 'failed') { super(reason) }
}

export const songArtists = (text: string) => [...new Set(text.split('、').map(name => name.trim()).filter(Boolean))]

// 兼容网易云曲目的两种字段格式。
export const fromNeteaseSong = (song: any): LX.Music.MusicInfoOnline => {
  const album = song.al ?? song.album ?? {}
  const qualities: LX.Music.MusicQualityType[] = []
  const qualityMap: LX.Music._MusicQualityType = {}
  for (const [type, info] of [['128k', song.l ?? song.lMusic], ['320k', song.h ?? song.hMusic], ['flac', song.sq], ['flac24bit', song.hr]] as const) {
    if (info) { qualities.push({ type, size: null }); qualityMap[type] = { size: null } }
  }
  return {
    id: `wy_${song.id as number}`,
    source: 'wy',
    name: song.name,
    singer: (song.ar ?? song.artists ?? []).map((artist: { name: string }) => artist.name).join('、'),
    interval: formatPlayTime((song.dt ?? song.duration ?? 0) / 1000),
    meta: { songId: song.id, albumName: album.name ?? '', albumId: album.id, picUrl: album.picUrl, qualitys: qualities, _qualitys: qualityMap },
  }
}

export const createSongBrowseTask = (song: LX.Music.MusicInfo, kind: SongBrowseKind, artist = song.singer, page = 1) => {
  let cancelled = false
  const cancels = new Set<() => void>()
  const check = () => { if (cancelled) throw new SongBrowseError('cancelled') }
  const wait = async <T>(pending: Promise<T>): Promise<T> => {
    check()
    let timer: ReturnType<typeof setTimeout>
    let cancel: () => void
    const stop = new Promise<never>((resolve, reject) => {
      cancel = () => { reject(new SongBrowseError('cancelled')) }
      cancels.add(cancel)
      timer = setTimeout(() => { reject(new SongBrowseError('timeout')) }, 15_000)
    })
    try { const result = await Promise.race([pending, stop]); check(); return result } finally { clearTimeout(timer!); cancels.delete(cancel!) }
  }
  const request = async(request: { promise: Promise<any>, cancelHttp: () => void }) => {
    cancels.add(request.cancelHttp)
    try { return await wait(request.promise) } finally { cancels.delete(request.cancelHttp) }
  }
  const convert = (rows: any[]) => rows.map(row => toNewMusicInfo(row) as LX.Music.MusicInfoOnline)
  const load = async(): Promise<SongBrowseResult> => {
    if (!Number.isInteger(page) || page < 1 || page > 50) throw new SongBrowseError('failed')
    if (kind == 'artist') {
      if (!artist.trim()) throw new SongBrowseError('unavailable')
      const source = song.source == 'local' ? 'wy' : song.source
      const result = await wait(musicSdk[source].musicSearch.search(artist, page, 30) as Promise<{ list: any[], total: number }>)
      return { songs: convert(result.list), hasMore: page * 30 < result.total && result.list.length > 0 }
    }
    if (song.source == 'local') throw new SongBrowseError('unavailable')
    const id = song.source == 'tx' && song.meta.albumMid ? song.meta.albumMid : song.meta.albumId
    if (!id || !/^[a-z\d]+$/i.test(String(id))) throw new SongBrowseError('unavailable')
    if (song.source == 'wy') {
      const { body } = await request(eapiRequest(`/api/v1/album/${id}`, { id }))
      if (body?.code != 200 || !Array.isArray(body.songs)) throw new SongBrowseError('failed')
      return { songs: body.songs.filter((row: any) => row.id && row.name).map(fromNeteaseSong), hasMore: false }
    }
    if (song.source == 'tx') {
      const { body: rawBody } = await wait(signRequest({
        comm: { ct: 24, cv: 0, uin: 0, format: 'json' },
        req: {
          module: 'music.musichallAlbum.AlbumSongList',
          method: 'GetAlbumSongList',
          param: { albumMid: /^\d+$/.test(String(id)) ? '' : String(id), albumID: /^\d+$/.test(String(id)) ? Number(id) : 0, begin: (page - 1) * 100, num: 100 },
        },
      }))
      const body = rawBody as any
      const data = body?.req?.data
      if (body?.code != 0 || body.req?.code != 0 || !Array.isArray(data?.songList) || !Number.isFinite(Number(data.totalNum))) throw new SongBrowseError('failed')
      const songs = convert(musicSdk.tx.musicSearch.handleResult(data.songList.map((row: any) => row.songInfo)))
      if (songs.length != data.songList.length || (!songs.length && page * 100 < data.totalNum)) throw new SongBrowseError('failed')
      return { songs, hasMore: page * 100 < data.totalNum }
    }
    if (song.source == 'kg') {
      const { body } = await request(httpFetch(`https://mobiles.kugou.com/api/v3/album/song?version=9108&albumid=${id}&plat=0&pagesize=100&area_code=0&page=${page}&with_res_tag=0`))
      if (body?.errcode != 0 || !Array.isArray(body.data?.info) || !Number.isFinite(Number(body.data.total))) throw new SongBrowseError('failed')
      const songs = await wait(getMusicInfosByList(body.data.info))
      return { songs: convert(songs), hasMore: page * 100 < body.data.total }
    }
    throw new SongBrowseError('unavailable')
  }
  return { promise: load(), cancel: () => { cancelled = true; for (const cancel of cancels) cancel(); cancels.clear() } }
}
