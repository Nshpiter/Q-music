export type DiscoveryProvider = 'tx' | 'wy' | 'kg'
export interface DiscoveryChoice { id: string, label: 'discovery_hot' | 'discovery_new' | 'discovery_rise' | 'discovery_chinese' | 'discovery_relax' | 'discovery_classic', sort: string, tag: string }
export interface DiscoveryPlaylist {
  id: string
  name: string
  author: string
  img?: string
  source: DiscoveryProvider
  total?: string
  play_count?: string
  desc?: string
}
export const discoveryChoices: Record<DiscoveryProvider, DiscoveryChoice[]> = {
  tx: [{ id: 'hot', label: 'discovery_hot', sort: '5', tag: '' }, { id: 'new', label: 'discovery_new', sort: '2', tag: '' }],
  kg: [{ id: 'hot', label: 'discovery_hot', sort: '6', tag: '' }, { id: 'new', label: 'discovery_new', sort: '7', tag: '' }, { id: 'rise', label: 'discovery_rise', sort: '8', tag: '' }],
  wy: [{ id: 'hot', label: 'discovery_hot', sort: 'hot', tag: '' }, { id: 'chinese', label: 'discovery_chinese', sort: 'hot', tag: '华语' }, { id: 'relax', label: 'discovery_relax', sort: 'hot', tag: '轻音乐' }, { id: 'classic', label: 'discovery_classic', sort: 'hot', tag: '经典' }],
}
interface Page { list: DiscoveryPlaylist[], total: number, limit: number }
export const createDiscoveryLoader = (fetchPage: (source: DiscoveryProvider, sort: string, tag: string, page: number) => Promise<Page>) => {
  const cache = new Map<string, { page: Page, expires: number }>()
  const pending = new Map<string, Promise<Page>>()
  return async(source: DiscoveryProvider, choiceId: string, page: number) => {
    const choice = discoveryChoices[source]?.find(choice => choice.id == choiceId)
    if (!choice || !Number.isInteger(page) || page < 1) throw new Error('Invalid discovery page')
    const key = `${source}:${choiceId}:${page}`
    const saved = cache.get(key)
    if (saved && saved.expires > Date.now()) return saved.page
    const running = pending.get(key)
    if (running) return running
    const request = (async() => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const raw = await Promise.race([
          fetchPage(source, choice.sort, choice.tag, page),
          new Promise<never>((resolve, reject) => { timer = setTimeout(() => { reject(new Error('Discovery timed out')) }, 18_000) }),
        ])
        if (!Array.isArray(raw?.list) || !Number.isFinite(Number(raw.limit)) || Number(raw.limit) <= 0) throw new Error('Invalid discovery response')
        const seen = new Set<string>()
        const list = raw.list.filter(item => {
          if (!item?.id || !item.name || seen.has(String(item.id))) return false
          seen.add(String(item.id))
          return true
        }).map(item => ({
          ...item,
          id: String(item.id),
          source,
          author: item.author || '',
          img: typeof item.img == 'string' ? item.img.replace(/\{size\}/g, '240').replace(/^http:\/\//, 'https://').replace(/^\/\//, 'https://') : '',
          total: item.total == null ? undefined : String(item.total),
        }))
        const result = { list, total: Number(raw.total) || list.length, limit: Number(raw.limit) }
        if (cache.size >= 24) cache.delete(cache.keys().next().value!)
        cache.set(key, { page: result, expires: Date.now() + 10 * 60_000 })
        return result
      } finally { clearTimeout(timer); pending.delete(key) }
    })()
    pending.set(key, request)
    return request
  }
}
