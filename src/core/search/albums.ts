import { withBrowseTimeout } from '@/core/browseRequest'
import { httpFetch } from '@/utils/request'
import qqSearch from '@/utils/musicSdk/tx/musicSearch'
import { eapiRequest } from '@/utils/musicSdk/wy/utils'

export const albumSources = ['tx', 'wy', 'kg'] as const
export type AlbumSource = typeof albumSources[number]
export interface Album {
  id: string
  source: AlbumSource
  name: string
  singer: string
  pic: string
  count: number
  date: string
}
interface Page { source: AlbumSource, page: number }
interface NeteaseAlbum { id: number, name: string, artists?: Array<{ name: string }>, artist?: { name: string }, publishTime: number, size: number, picUrl: string }
interface KugouAlbum { albumid: number, albumname: string, singername: string, publishtime: string, songcount: number, imgurl: string }
const limit = 20
const imageUrl = (value?: string) => value?.replace(/^http:/, 'https:').replace('{size}', '240') ?? ''
const albumId = (id: unknown) => id == null ? '' : String(id)

export const firstAlbumPages = (source: LX.OnlineSource | 'all'): Page[] =>
  albumSources.filter(id => source == 'all' || id == source).map(source => ({ source, page: 1 }))

const fetchPage = async(text: string, { source, page }: Page) => {
  let list: Album[], total: number
  if (source == 'tx') {
    const data = await qqSearch.musicSearch(text, page, limit, 0, 2)
    if (data.meta?.is_filter < 0) throw new Error('Album search rejected')
    total = Number(data.meta?.sum || data.meta?.estimate_sum)
    const items = data.body?.item_album ?? (total === 0 ? [] : null)
    list = items.map((row: { albummid: string, name: string, singer: string, publish_date: string, song_num: number, pic: string }) => ({
      source, id: albumId(row.albummid), name: row.name, singer: row.singer, date: row.publish_date, count: row.song_num, pic: imageUrl(row.pic),
    }))
  } else if (source == 'wy') {
    const response = await eapiRequest('/api/cloudsearch/pc', { s: text, type: 10, limit, offset: (page - 1) * limit, total: true }).promise
    const body = response.body as unknown as { code: number, result?: { albumCount: number, albums?: NeteaseAlbum[] } }
    if (body.code != 200) throw new Error('Album search rejected')
    total = Number(body.result?.albumCount)
    const items = body.result?.albums ?? (total === 0 ? [] : undefined)
    if (!Array.isArray(items)) throw new Error('Invalid album search response')
    list = items.map(row => ({
      source,
      id: albumId(row.id),
      name: row.name,
      singer: (row.artists ?? [row.artist]).map(artist => artist?.name).filter(Boolean).join('、'),
      date: row.publishTime > 0 ? String(new Date(row.publishTime).getFullYear()) : '',
      count: row.size,
      pic: imageUrl(row.picUrl),
    }))
  } else {
    const response = await httpFetch(`https://mobilecdn.kugou.com/api/v3/search/album?keyword=${encodeURIComponent(text)}&page=${page}&pagesize=${limit}`).promise
    const body = response.body as unknown as { status: number, data: { total: number, info: KugouAlbum[] } }
    if (body.status != 1) throw new Error('Album search rejected')
    total = Number(body.data?.total)
    list = body.data.info.map(row => ({
      source, id: albumId(row.albumid), name: row.albumname, singer: row.singername, date: row.publishtime?.slice(0, 10), count: row.songcount, pic: imageUrl(row.imgurl),
    }))
  }
  const hasMore = list.length >= limit && (!Number.isFinite(total) || page * limit < total)
  return { list: list.filter(album => album.id && album.name), hasMore }
}

export const searchAlbumPages = async(text: string, pages: Page[]) => {
  const results = await Promise.allSettled(pages.map(async page => withBrowseTimeout(fetchPage(text, page))))
  const next: Page[] = []
  const failed: AlbumSource[] = []
  const batches: Album[][] = []
  for (const [index, result] of results.entries()) {
    const page = pages[index]
    if (result.status == 'rejected') {
      failed.push(page.source)
      next.push(page)
    } else {
      batches.push(result.value.list)
      if (result.value.hasMore) next.push({ source: page.source, page: page.page + 1 })
    }
  }
  const list: Album[] = []
  for (let i = 0; i < Math.max(0, ...batches.map(batch => batch.length)); i++) {
    for (const batch of batches) if (batch[i]) list.push(batch[i])
  }
  return { list, next, failed }
}
