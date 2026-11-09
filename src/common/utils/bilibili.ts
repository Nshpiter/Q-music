// 公开网页接口流程参考 WalnutBai/lx-lxwalnut-music-mobile (Apache-2.0, main-debug)。
// 独立实现：保留请求失败、取消和多 P 身份，不执行远程音源脚本。
export const BILIBILI_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', Referer: 'https://www.bilibili.com/' }
export const isBilibiliMediaUrl = (url: string) => /^https:\/\/(?:(?:[\w-]+\.)+bilivideo\.(?:com|cn)|upos-hz-mirrorakam\.akamaized\.net)\//i.test(url)
type Request = (url: string, headers: Record<string, string>, signal?: AbortSignal) => Promise<Record<string, any>>
const bvidPattern = /^BV[0-9A-Za-z]{10}$/
interface CollectionRef { kind: 'favorite' | 'season' | 'series', mid: string, id: string }
// 兼容新旧空间合集链接；不跟随任意分享地址，避免把外部 URL 当成请求目标。
export const parseBilibiliCollection = (input: string): CollectionRef | undefined => {
  const text = input.trim()
  const favorite = /^(?:ml|https?:\/\/(?:www\.)?bilibili\.com\/medialist\/(?:detail|play)\/ml)([1-9]\d*)(?:\/?(?:[?#].*)?)$/i.exec(text)
  if (favorite) return { kind: 'favorite', mid: '', id: favorite[1] }
  const folder = /^https?:\/\/space\.bilibili\.com\/([1-9]\d*)\/favlist\/?(?:\?([^#]*))?(?:#.*)?$/i.exec(text)
  if (folder) {
    const id = new URLSearchParams(folder[2] ?? '').get('fid')
    if (id && /^[1-9]\d*$/.test(id)) return { kind: 'favorite', mid: folder[1], id }
    return
  }
  const match = /^https?:\/\/space\.bilibili\.com\/([1-9]\d*)\/(?:lists\/([1-9]\d*)\/?|channel\/(collectiondetail|seriesdetail)\/?)(?:\?([^#]*))?(?:#.*)?$/i.exec(input.trim())
  if (!match) return
  const query = new Map((match[4] ?? '').split('&').map(part => {
    const [key, value = ''] = part.split('=')
    return [key, value]
  }))
  const id = match[2] ?? query.get('sid')
  if (!id || !/^[1-9]\d*$/.test(id)) return
  const kind = match[3] == 'seriesdetail' || query.get('type') == 'series' ? 'series' : 'season'
  return { kind, mid: match[1], id }
}
const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const clean = (text: unknown) => String(text ?? '').replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, key: string) => {
  if (key[0] != '#') return entities[key.toLowerCase()] ?? entity
  const point = key[1].toLowerCase() == 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1))
  return point > 0 && point <= 0x10FFFF && !(point >= 0xD800 && point <= 0xDFFF) ? String.fromCodePoint(point) : entity
})
const duration = (value: unknown) => typeof value == 'number' ? value : String(value ?? '0').split(':').reduce((seconds, part) => seconds * 60 + Number(part), 0)
const format = (item: Record<string, any>, part?: Record<string, any>) => {
  const seconds = Math.max(0, Math.floor(duration(part?.duration ?? item.duration)))
  const songmid = `${item.bvid}:${part?.cid ?? 0}`
  return {
    source: 'bi',
    songmid,
    name: clean(part?.part || item.title),
    singer: clean(item.author ?? item.owner?.name ?? item.upper?.name),
    albumName: clean(item.title),
    albumId: item.bvid,
    img: String(item.pic ?? item.cover ?? '').replace(/^http:\/\//, 'https://').replace(/^\/\//, 'https://'),
    interval: `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`,
    types: [{ type: '192k', size: null }],
    _types: { '192k': { size: null } },
    typeUrl: {},
  }
}

export const createBilibiliClient = (request: Request) => {
  let fingerprint: { cookie: string, expires: number } | undefined
  let fingerprintTask: Promise<string> | undefined
  const cache = new Map<string, { value: Record<string, any>, expires: number }>()
  const readVideo = async(bvid: string, signal?: AbortSignal) => {
    if (signal?.aborted) throw new Error('cancelled')
    const key = 'video:' + bvid
    const saved = cache.get(key)
    if (saved && saved.expires > Date.now()) return saved.value
    const value = await call('/x/web-interface/view', { bvid }, signal)
    if (!Array.isArray(value.pages) || !value.pages.length) throw new Error('Bilibili: invalid_pages')
    cache.set(key, { value, expires: Date.now() + 300_000 })
    if (cache.size > 80) cache.delete(cache.keys().next().value!)
    return value
  }
  const call = async(path: string, params: Record<string, unknown>, signal?: AbortSignal, cookie = '') => {
    if (signal?.aborted) throw new Error('cancelled')
    const query = Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')
    const body = await request(`https://api.bilibili.com${path}${query ? '?' + query : ''}`, { ...BILIBILI_HEADERS, ...(cookie ? { Cookie: cookie } : {}) }, signal)
    if (signal?.aborted) throw new Error('cancelled')
    if (body?.code != 0 || !body.data) throw new Error(`Bilibili: ${Number.isFinite(Number(body?.code)) ? body.code : 'invalid_response'}`)
    return body.data as Record<string, any>
  }
  const getFingerprint = async() => {
    if (fingerprint && fingerprint.expires > Date.now()) return Promise.resolve(fingerprint.cookie)
    fingerprintTask ??= call('/x/frontend/finger/spi', {}).then(data => {
      if (typeof data.b_3 != 'string' || typeof data.b_4 != 'string' || /[\r\n;]/.test(data.b_3 + data.b_4)) throw new Error('Bilibili: invalid_fingerprint')
      fingerprint = { cookie: `buvid3=${data.b_3}; buvid4=${data.b_4}`, expires: Date.now() + 3600_000 }
      return fingerprint.cookie
    }).finally(() => { fingerprintTask = undefined })
    return fingerprintTask
  }
  const suggest = async(keyword: string, signal?: AbortSignal): Promise<string[]> => {
    if (signal?.aborted) throw new Error('cancelled')
    if (!keyword.trim()) return []
    const body = await request(`https://s.search.bilibili.com/main/suggest?term=${encodeURIComponent(keyword.trim())}&main_ver=v1&highlight=&func=suggest&suggest_type=accurate&sub_type=tag&tag_num=10`, BILIBILI_HEADERS, signal)
    if (signal?.aborted) throw new Error('cancelled')
    if (body?.code != 0 || !Array.isArray(body.result?.tag)) throw new Error('Bilibili: invalid_suggestions')
    const words: string[] = body.result.tag.map((item: Record<string, unknown>) => clean(item.value ?? item.term).trim()).filter(Boolean)
    return [...new Set(words)].slice(0, 10)
  }
  // 搜索结果按需展开，不为每一条视频额外请求分 P 和合集。
  const videoContents = async(id: string, signal?: AbortSignal) => {
    const bvid = id.split(':')[0]
    if (!bvidPattern.test(bvid)) throw new Error('Bilibili: invalid_track')
    const data = await readVideo(bvid, signal)
    if (!Array.isArray(data.pages) || !data.pages.length || data.pages.some((part: Record<string, any>) => !Number.isSafeInteger(part.cid) || part.cid <= 0)) throw new Error('Bilibili: invalid_pages')
    const parts: Array<ReturnType<typeof format>> = data.pages.map((part: Record<string, any>) => format({ ...data, bvid }, part))
    const season = data.ugc_season
    const mid = String(season?.mid ?? data.owner?.mid ?? '')
    const seasonId = String(season?.id ?? '')
    return {
      title: clean(data.title),
      parts,
      collection: /^[1-9]\d*$/.test(mid) && /^[1-9]\d*$/.test(seasonId)
        ? { name: clean(season.title), url: `https://space.bilibili.com/${mid}/lists/${seasonId}?type=season` }
        : undefined,
    }
  }
  const collection = async(input: string, page = 1, limit = 30, signal?: AbortSignal) => {
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error('invalid_link')
    const ref = parseBilibiliCollection(input)
    if (ref?.kind == 'favorite') {
      const data = await call('/x/v3/fav/resource/list', { media_id: ref.id, pn: page, ps: limit, platform: 'web', type: 0 }, signal)
      const total = Number(data.info?.media_count)
      if (!Number.isSafeInteger(total) || total < 0 || (total > 0 && !Array.isArray(data.medias))) throw new Error('Bilibili: invalid_collection')
      const items: Array<Record<string, any>> = data.medias ?? []
      const list = items.filter(item => Number(item.type) == 2 && bvidPattern.test(String(item.bvid)) && !(Number(item.attr) & 9)).map(item => format(item))
      return { list, total, limit, page, allPage: Math.ceil(total / limit), source: 'bi', info: { name: clean(data.info.title) }, incomplete: list.length != items.length }
    }
    if (ref) {
      const data = await call(ref.kind == 'season' ? '/x/polymer/web-space/seasons_archives_list' : '/x/series/archives', ref.kind == 'season'
        ? { mid: ref.mid, season_id: ref.id, page_num: page, page_size: limit }
        : { mid: ref.mid, series_id: ref.id, pn: page, ps: limit }, signal)
      const meta = ref.kind == 'season' ? data.meta : (await call('/x/series/series', { series_id: ref.id }, signal)).meta
      const total = Number(data.page?.total)
      const actualLimit = Number(data.page?.page_size ?? data.page?.size)
      if (!Array.isArray(data.archives) || !Number.isSafeInteger(total) || total < 0 || actualLimit != limit) throw new Error('Bilibili: invalid_collection')
      const list: Array<ReturnType<typeof format>> = data.archives.filter((item: Record<string, any>) => bvidPattern.test(String(item.bvid))).map((item: Record<string, any>) => ({ ...format(item), albumName: clean(meta?.name) }))
      return { list, total, limit, page, allPage: Math.ceil(total / limit), source: 'bi', info: { name: clean(meta?.name) }, incomplete: list.length != data.archives.length }
    }
    const matched = /^(?:https?:\/\/(?:www\.)?bilibili\.com\/video\/)?(BV[0-9A-Za-z]{10})(?:\/?(?:[?#].*)?)$/.exec(input.trim())
    if (!matched) throw new Error('invalid_link')
    const data = await readVideo(matched[1], signal)
    if (!Array.isArray(data.pages) || data.pages.some((part: Record<string, any>) => !Number.isSafeInteger(part.cid) || part.cid <= 0)) throw new Error('Bilibili: invalid_pages')
    const list: Array<ReturnType<typeof format>> = data.pages.slice((page - 1) * limit, page * limit).map((part: Record<string, any>) => format(data, part))
    return { list, total: data.pages.length, limit, page, allPage: Math.ceil(data.pages.length / limit), source: 'bi', info: { name: clean(data.title) }, incomplete: false }
  }
  const importCollection = async(input: string, progress?: (current: number, total: number) => void, shouldCancel?: () => boolean, signal?: AbortSignal) => {
    const isCancelled = () => signal?.aborted === true || shouldCancel?.() === true
    const list: Array<ReturnType<typeof format>> = []
    const seen = new Set<string>()
    let name = ''
    let total = 0
    for (let page = 1; page <= 500; page++) {
      if (isCancelled()) throw new Error('cancelled')
      const result = await collection(input, page, 30, signal)
      if (isCancelled()) throw new Error('cancelled')
      if (page == 1) { name = result.info.name; total = result.total }
      if (result.incomplete || total != result.total) throw new Error('incomplete')
      for (const item of result.list) {
        if (seen.has(item.songmid)) throw new Error('incomplete')
        seen.add(item.songmid); list.push(item)
      }
      progress?.(list.length, total)
      if (list.length == total) return { list, name, total }
      if (!result.list.length || list.length > total) throw new Error('incomplete')
    }
    throw new Error('incomplete')
  }
  const search = async(keyword: string, page = 1, requestedLimit = 20, signal?: AbortSignal) => {
    const limit = Math.max(1, Math.min(50, requestedLimit))
    if (parseBilibiliCollection(keyword)) return collection(keyword, page, limit, signal)
    const matched = /(?:^|\/)(BV[0-9A-Za-z]{10})(?:$|[/?#:])/.exec(keyword.trim())
    if (matched) {
      const data = await readVideo(matched[1], signal)
      if (!Array.isArray(data.pages)) throw new Error('Bilibili: invalid_pages')
      const pages: Array<Record<string, any>> = data.pages
      return { list: pages.slice((page - 1) * limit, page * limit).map(part => format(data, part)), total: pages.length, allPage: Math.ceil(pages.length / limit), limit, source: 'bi' }
    }
    const cacheKey = 'search:' + JSON.stringify([keyword.trim(), page, limit])
    const cached = cache.get(cacheKey)
    if (signal?.aborted) throw new Error('cancelled')
    if (cached && cached.expires > Date.now()) return cached.value as { list: Array<ReturnType<typeof format>>, total: number, allPage: number, limit: number, source: string }
    const data = await call('/x/web-interface/search/type', { search_type: 'video', keyword, page, page_size: limit }, signal, await getFingerprint())
    if (!Array.isArray(data.result)) throw new Error('Bilibili: invalid_search')
    const results: Array<Record<string, any>> = data.result
    const result = { list: results.filter(item => bvidPattern.test(String(item.bvid))).map(item => format(item)), total: Number(data.numResults) || 0, allPage: Number(data.numPages) || 0, limit, source: 'bi' }
    cache.set(cacheKey, { value: result, expires: Date.now() + 30_000 })
    if (cache.size > 80) cache.delete(cache.keys().next().value!)
    return result
  }
  const playback = async(id: string, signal?: AbortSignal) => {
    const [bvid, rawCid] = id.split(':')
    if (!bvidPattern.test(bvid) || !/^\d+$/.test(rawCid ?? '')) throw new Error('Bilibili: invalid_track')
    const detail = await readVideo(bvid, signal)
    const pages: Array<Record<string, any>> = detail.pages
    if (!Array.isArray(pages)) throw new Error('Bilibili: invalid_pages')
    const part = rawCid == '0' ? pages[0] : pages.find(item => String(item.cid) == rawCid)
    if (!part) throw new Error('Bilibili: part_removed')
    const data = await call('/x/player/playurl', { bvid, cid: part.cid, fnval: 16 }, signal)
    const audio: Array<Record<string, any>> = data.dash?.audio
    if (!Array.isArray(audio) || !audio.length) throw new Error('Bilibili: audio_unavailable')
    const tracks = audio.filter(item => /^mp4a/.test(String(item.codecs ?? ''))).sort((a, b) => Number(b.bandwidth) - Number(a.bandwidth))
    const candidates = tracks.flatMap(item => [item.baseUrl ?? item.base_url, ...(Array.isArray(item.backupUrl ?? item.backup_url) ? item.backupUrl ?? item.backup_url : [])])
    const urls = candidates.filter((value): value is string => typeof value == 'string' && isBilibiliMediaUrl(value))
    // 优先常规 CDN，避免 PCDN 节点不可达；只采用官方接口返回的受信地址。
    const url = urls.find(value => /\.bilivideo\.com\//i.test(value)) ?? urls[0]
    if (!url) throw new Error('Bilibili: audio_unavailable')
    return { url, quality: '192k' as const }
  }
  return { search, suggest, videoContents, playback, collection, importCollection, prepareSearch: getFingerprint }
}
