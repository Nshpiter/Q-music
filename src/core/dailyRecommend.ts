import { LIST_IDS } from '@/config/constant'
import { getList as getHotSearchList } from '@/core/hotSearch'
import { getListMusics } from '@/core/list'
import { toNewMusicInfo } from '@/utils'
import musicSdk from '@/utils/musicSdk'

const DAILY_COUNT = 12
const SEARCH_LIMIT = 12
const supportedSources: LX.OnlineSource[] = ['kw', 'kg', 'tx', 'wy', 'mg']
const fallbackKeywords = ['华语流行', '热门歌曲', '经典歌曲', '新歌', '治愈', '轻音乐']

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

  const sourceOrder = [source, ...supportedSources.filter(item => item != source)]
  const preferenceKeywords = getPreferenceKeywords(loved)
  const lovedIds = new Set(loved.map(item => item.id))
  const candidateIds = new Set<string>()
  const candidateNames = new Set<string>()
  const candidates: LX.Music.MusicInfoOnline[] = []

  for (const currentSource of sourceOrder) {
    const sdk = musicSdk[currentSource]
    if (!sdk?.musicSearch) continue
    const hotKeywords = await getHotSearchList(currentSource).catch(() => [])
    const keywords = [...new Set([...preferenceKeywords, ...hotKeywords, ...fallbackKeywords])].slice(0, 6)
    const results = await Promise.all(keywords.map(async keyword => {
      return (sdk.musicSearch.search(keyword, 1, SEARCH_LIMIT) as Promise<SearchResult>)
        .then(data => data.list)
        .catch(() => [])
    }))
    for (const rawItem of results.flat()) {
      const item = toNewMusicInfo(rawItem) as LX.Music.MusicInfoOnline
      const nameKey = `${item.name.trim().toLowerCase()}__${item.singer.trim().toLowerCase()}`
      if (lovedIds.has(item.id) || candidateIds.has(item.id) || candidateNames.has(nameKey)) continue
      candidateIds.add(item.id)
      candidateNames.add(nameKey)
      candidates.push(item)
    }
    if (candidates.length >= DAILY_COUNT * 2) break
  }

  const fallback = loved.filter((item): item is LX.Music.MusicInfoOnline => item.source != 'local')
  const daily = shuffle(candidates.length >= DAILY_COUNT ? candidates : [...candidates, ...fallback], cacheKey).slice(0, DAILY_COUNT)
  cache.set(cacheKey, daily)
  return daily
}
