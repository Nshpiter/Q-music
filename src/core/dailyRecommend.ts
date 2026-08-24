import { LIST_IDS } from '@/config/constant'
import { getList as getHotSearchList } from '@/core/hotSearch'
import { getListMusics } from '@/core/list'
import { deduplicationList, toNewMusicInfo } from '@/utils'
import musicSdk from '@/utils/musicSdk'

const DAILY_COUNT = 12
const SEARCH_LIMIT = 6
const supportedSources: LX.OnlineSource[] = ['kw', 'kg', 'tx', 'wy', 'mg']

interface SearchResult {
  list: LX.Music.MusicInfoOnline[]
}

let refreshIndex = 0
const cache = new Map<string, LX.Music.MusicInfoOnline[]>()

const getDayKey = () => {
  const date = new Date()
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

const hash = (text: string) => {
  let value = 2166136261
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

const shuffle = <T>(list: T[], seedText: string) => {
  const result = [...list]
  let seed = hash(seedText) || 1
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

const pickSource = (requestedSource: LX.OnlineSource | 'all', loved: LX.Music.MusicInfo[]) => {
  if (requestedSource != 'all' && supportedSources.includes(requestedSource)) return requestedSource
  const counts = new Map<LX.OnlineSource, number>()
  for (const item of loved) {
    if (item.source == 'local' || !supportedSources.includes(item.source)) continue
    counts.set(item.source, (counts.get(item.source) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'kw'
}

const getPreferenceKeywords = (loved: LX.Music.MusicInfo[]) => {
  const counts = new Map<string, number>()
  for (const item of loved) {
    for (const singer of item.singer.split(/[、,&/]+/)) {
      const keyword = singer.trim()
      if (keyword.length < 2) continue
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1)
    }
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([keyword]) => keyword)
}

export const getDailyRecommend = async(requestedSource: LX.OnlineSource | 'all', force = false) => {
  const loved = await getListMusics(LIST_IDS.LOVE)
  const source = pickSource(requestedSource, loved)
  if (force) refreshIndex++
  const cacheKey = `${getDayKey()}__${source}__${refreshIndex}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const hotKeywords = await getHotSearchList(source).catch(() => [])
  const keywords = [...new Set([...getPreferenceKeywords(loved), ...hotKeywords])].slice(0, 8)
  const results = await Promise.all(keywords.map(async keyword => {
    const sdk = musicSdk[source]
    if (!sdk?.musicSearch) return []
    return (sdk.musicSearch.search(keyword, 1, SEARCH_LIMIT) as Promise<SearchResult>)
      .then(data => data.list)
      .catch(() => [])
  }))
  const lovedIds = new Set(loved.map(item => item.id))
  const candidates = deduplicationList(results.flat().map(item => toNewMusicInfo(item) as LX.Music.MusicInfoOnline))
    .filter(item => !lovedIds.has(item.id))
  const fallback = loved.filter((item): item is LX.Music.MusicInfoOnline => item.source != 'local')
  const daily = shuffle(candidates.length ? candidates : fallback, cacheKey).slice(0, DAILY_COUNT)
  cache.set(cacheKey, daily)
  return daily
}
