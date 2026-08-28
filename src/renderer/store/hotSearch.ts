import { reactive, markRaw } from '@common/utils/vueTools'
import music from '@renderer/utils/musicSdk'

// import { deduplicationList } from '@common/utils/renderer'

export type Source = LX.OnlineSource | 'all'

interface SourceLists extends Partial<Record<LX.OnlineSource, string[]>> {
  'all': string[]
}

export const sources: Source[] = markRaw([])

export const sourceList: SourceLists = markRaw({
  all: reactive<string[]>([]),
})


for (const source of music.sources) {
  if (!music[source.id as LX.OnlineSource]?.hotSearch) continue
  sources.push(source.id as LX.OnlineSource)
  sourceList[source.id as LX.OnlineSource] = reactive<string[]>([])
}
sources.push('all')


// 空数组也是一次成功的读取结果，不能再用 length 判断是否命中缓存。
const loadedSources = new Set<Source>()
const sourceVersions = new Map<Source, number>()
const pendingRequests = new Map<Source, { version: number, promise: Promise<string[]> }>()
let allRequestId = 0

const getSourceVersion = (source: Source) => sourceVersions.get(source) ?? 0

const normalizeList = (list: unknown): string[] => {
  if (!Array.isArray(list)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of list) {
    if (typeof value != 'string') continue
    const word = value.trim()
    if (!word || seen.has(word)) continue
    seen.add(word)
    result.push(word)
    if (result.length >= 20) break
  }
  return result
}

const replaceList = (source: Source, list: unknown): string[] => {
  const normalized = normalizeList(list)
  const current = sourceList[source]
  if (Array.isArray(current)) {
    current.splice(0, current.length, ...normalized)
  } else {
    sourceList[source] = reactive(normalized)
  }
  return sourceList[source] ?? []
}

const setList = (source: Source, list: unknown, version = getSourceVersion(source)): string[] => {
  if (version != getSourceVersion(source)) return sourceList[source] ?? []
  const result = replaceList(source, list)
  if (source != 'all') loadedSources.add(source)
  return result
}

const fetchSourceList = async(source: LX.OnlineSource): Promise<string[]> => {
  const version = getSourceVersion(source)
  const pending = pendingRequests.get(source)
  if (pending?.version == version) return pending.promise

  const hotSearch = music[source]?.hotSearch
  const request = (hotSearch
    ? Promise.resolve().then(() => hotSearch.getList()).then(data => normalizeList(data?.list))
    : Promise.resolve([])
  ).then(list => {
    // 清缓存后旧请求即使晚到，也不能覆盖新状态。
    if (version != getSourceVersion(source)) return sourceList[source] ?? []
    return setList(source, list, version)
  })
  const task = request.finally(() => {
    if (pendingRequests.get(source)?.version == version) pendingRequests.delete(source)
  })
  pendingRequests.set(source, { version, promise: task })
  return task
}

interface SourceResult {
  source: LX.OnlineSource
  list: unknown
  version: number
  failed?: boolean
}

const setLists = (lists: SourceResult[], requestId: number): string[] => {
  const wordsMap = new Map<string, number>()
  for (const { source, list, version, failed } of lists) {
    if (version != getSourceVersion(source)) continue
    const normalized = normalizeList(list)
    // 请求失败不应被当成“已加载的空榜单”，下次打开聚合榜时仍可重试。
    if (!failed) setList(source, normalized, version)
    for (const item of normalized) wordsMap.set(item, (wordsMap.get(item) ?? 0) + 1)
  }
  const wordsMapArr = Array.from(wordsMap)
  wordsMapArr.sort((a, b) => a[0].localeCompare(b[0]))
  wordsMapArr.sort((a, b) => b[1] - a[1])
  const words = wordsMapArr.map(item => item[0])
  const result = words.slice(0, sources.length * 10)
  // 过期请求不能写入聚合缓存，但仍返回本次计算结果，避免并发打开面板
  // 时较早的调用拿到旧的空数组。
  if (requestId != allRequestId) return result
  return setList('all', result, getSourceVersion('all'))
}

export const getList = async(source: Source): Promise<string[]> => {
  if (source == 'all') {
    const requestId = ++allRequestId
    const tasks: Array<Promise<SourceResult>> = []
    for (const sourceId of sources) {
      if (sourceId == 'all') continue
      const version = getSourceVersion(sourceId)
      const listTask = loadedSources.has(sourceId)
        ? Promise.resolve(sourceList[sourceId] ?? [])
        : fetchSourceList(sourceId)
      tasks.push(listTask
        .then(list => ({ source: sourceId, list, version }))
        .catch(() => {
          return { source: sourceId, list: [], version, failed: true }
        }))
    }
    return Promise.all(tasks).then(results => setLists(results, requestId))
  }

  if (loadedSources.has(source)) return sourceList[source] ?? []
  return fetchSourceList(source)
}


export const clearList = (source: Source) => {
  // 聚合列表依赖所有平台缓存，刷新 all 时必须一并失效。
  allRequestId++
  const clearOne = (target: Source) => {
    sourceVersions.set(target, getSourceVersion(target) + 1)
    loadedSources.delete(target)
    replaceList(target, [])
  }
  if (source == 'all') {
    for (const sourceId of sources) {
      if (sourceId != 'all') clearOne(sourceId)
    }
  }
  clearOne(source)
}
