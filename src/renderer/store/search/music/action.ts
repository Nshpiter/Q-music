import { markRaw } from '@common/utils/vueTools'
import music from '@renderer/utils/musicSdk'
import { toNewMusicInfo } from '@renderer/utils'
import { assertApiSupport } from '@renderer/store/utils'

import { sources, maxPages, listInfos } from './state'
import { getSearchSingerTokens, getSearchVariantKinds, normalizeSearchText, rankSearchItems } from './ranking'
import type { SearchAlbumEvidence, SearchSourceRank } from './ranking'

interface SearchResult {
  list: LX.Music.MusicInfo[]
  allPage: number
  limit: number
  total: number
  source: LX.OnlineSource
}

const aggregateSources = new WeakMap<LX.Music.MusicInfo, LX.Music.MusicInfo[]>()
const aggregateSourceRanks = new WeakMap<LX.Music.MusicInfo, SearchSourceRank>()

// Music IDs are normally source-prefixed, but a few providers (notably
// legacy KuGou results) can reuse the same ID format. Search aggregation must
// retain one entry per provider so the source picker and fallback routes do
// not silently lose a candidate.
const deduplicationListBySource = <T extends LX.Music.MusicInfo>(list: T[]): T[] => {
  const keys = new Set<string>()
  return list.filter(item => {
    const key = `${item.source}__${item.id}`
    if (keys.has(key)) return false
    keys.add(key)
    return true
  })
}

const normalizeSinger = (singer: string) => getSearchSingerTokens(singer).join('')

const getAggregateKey = (musicInfo: LX.Music.MusicInfo) => {
  const variantKinds = getSearchVariantKinds(`${musicInfo.name} ${musicInfo.meta.albumName ?? ''}`).join(',')
  return `${normalizeSearchText(musicInfo.name)}__${normalizeSinger(musicInfo.singer)}__${variantKinds}`
}

const mergeSourceResults = (list: LX.Music.MusicInfo[]) => {
  const groups = new Map<string, LX.Music.MusicInfo[]>()
  for (const item of deduplicationListBySource(list)) {
    const key = getAggregateKey(item)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return [...groups.values()].map(group => {
    const selected = group.find(item => assertApiSupport(item.source)) ?? group[0]
    for (const item of group) aggregateSources.set(item, group)
    return selected
  })
}

export const getAggregateSources = (musicInfo: LX.Music.MusicInfo) => {
  return aggregateSources.get(musicInfo) ?? [musicInfo]
}

export const selectAggregateSource = (index: number, source: LX.OnlineSource) => {
  const listInfo = listInfos.all
  const current = listInfo.list[index]
  const target = current && getAggregateSources(current).find(item => item.source == source)
  if (target) listInfo.list[index] = target
}


const getSourceRanks = (musicInfo: LX.Music.MusicInfo) => {
  const sourceRanks = new Map<LX.Source, SearchSourceRank>()
  for (const sourceInfo of getAggregateSources(musicInfo)) {
    const rank = aggregateSourceRanks.get(sourceInfo)
    if (!rank) continue
    const current = sourceRanks.get(sourceInfo.source)
    if (!current || rank.rank < current.rank) sourceRanks.set(sourceInfo.source, rank)
  }
  return [...sourceRanks.values()]
}

const getAlbumEvidence = (musicInfo: LX.Music.MusicInfo): SearchAlbumEvidence[] => {
  const albums = new Map<string, SearchAlbumEvidence>()
  for (const sourceInfo of getAggregateSources(musicInfo)) {
    const name = sourceInfo.meta.albumName ?? ''
    if (!name) continue

    let albumId: string | number | undefined
    if (sourceInfo.source != 'local') {
      albumId = sourceInfo.meta.albumId
      if (!albumId && sourceInfo.source == 'tx') albumId = sourceInfo.meta.albumMid
    }
    // 某些平台不会返回专辑 ID。单平台搜索仍需要识别“专辑名精确命中 +
    // 多首曲目”的原声簇，因此用带来源前缀的规范化专辑名作保守兜底；
    // 不同平台不会因为同名专辑被错误合并。
    const key = albumId == null || albumId === ''
      ? `${sourceInfo.source}:name:${normalizeSearchText(name)}`
      : `${sourceInfo.source}:${albumId}`
    const evidence = { name, key }
    albums.set(`${key ?? ''}__${normalizeSearchText(name)}`, evidence)
  }
  return [...albums.values()]
}

const rankAggregateList = (list: LX.Music.MusicInfo[], keyword: string, allowSingleSourceCollection = false) => {
  return rankSearchItems(list.map((item, index) => ({
    data: item,
    name: item.name,
    singer: item.singer,
    albums: getAlbumEvidence(item),
    sourceRanks: getSourceRanks(item),
    index,
  })), keyword, { allowSingleSourceCollection })
}


const setLists = (results: SearchResult[], page: number, text: string): LX.Music.MusicInfo[] => {
  let pages = []
  let totals = []
  let limit = 0
  let list: LX.Music.MusicInfo[] = []
  for (const [sourceOrder, source] of results.entries()) {
    maxPages[source.source] = source.allPage
    limit = Math.max(source.limit, limit)
    if (source.allPage < page) continue
    list.push(...source.list.map((item, rank) => {
      const musicInfo = markRaw(toNewMusicInfo(item))
      aggregateSourceRanks.set(musicInfo, { rank, sourceOrder })
      return musicInfo
    }))
    pages.push(source.allPage)
    totals.push(source.total)
  }
  list = mergeSourceResults(list)
  let listInfo = listInfos.all
  listInfo.maxPage = Math.max(0, ...pages)
  const total = Math.max(0, ...totals)
  if (page == 1 || (total && list.length)) listInfo.total = total
  else listInfo.total = limit * page
  // listInfo.limit = limit
  listInfo.page = page
  // 聚合结果中经常只有一个平台能返回完整的电影/专辑曲目簇，即使其他
  // 平台返回了零散同名歌曲，也要启用保守的单来源簇识别；识别门槛由
  // ranking.ts 统一控制，避免把普通同名歌曲误判为原声。
  listInfo.list = rankAggregateList(list, text, true)
  if (text && !list.length && page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
  else listInfo.noItemLabel = ''
  return listInfo.list
}

const setList = (datas: SearchResult, page: number, text: string): LX.Music.MusicInfo[] => {
  // console.log(datas.source, datas.list)
  let listInfo = listInfos[datas.source]!
  // 单平台结果也统一经过轻量排序：保留原生名次作为主信号，同时把
  // 可靠的原声/原唱条目置于普通同名翻唱之前。
  const list = deduplicationListBySource(datas.list.map((item, rank) => {
    const musicInfo = markRaw(toNewMusicInfo(item))
    aggregateSourceRanks.set(musicInfo, { rank, sourceOrder: 0 })
    return musicInfo
  }))
  listInfo.list = rankAggregateList(list, text, true)
  if (page == 1 || (datas.total && datas.list.length)) listInfo.total = datas.total
  else listInfo.total = datas.limit * page
  listInfo.maxPage = datas.allPage
  listInfo.page = page
  listInfo.limit = datas.limit
  if (text && !datas.list.length && page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
  else listInfo.noItemLabel = ''
  return listInfo.list
}

export const resetListInfo = (sourceId: LX.OnlineSource | 'all'): [] => {
  let listInfo = listInfos[sourceId]
  if (!listInfo) return []
  listInfo.list = []
  listInfo.page = 0
  listInfo.maxPage = 0
  listInfo.total = 0
  listInfo.noItemLabel = ''
  return []
}

export const search = async(text: string, page: number, sourceId: LX.OnlineSource | 'all'): Promise<LX.Music.MusicInfo[]> => {
  const listInfo = listInfos[sourceId]
  if (!text) return resetListInfo(sourceId)
  const key = `${page}__${text}`
  if (sourceId == 'all') {
    listInfo!.noItemLabel = window.i18n.t('list__loading')
    listInfo!.key = key
    let task = []
    for (const source of sources) {
      if (source == 'all') continue
      task.push((music[source]?.musicSearch.search(text, page, listInfos.all.limit) ?? Promise.reject(new Error('source not found: ' + source))).catch((error: any) => {
        console.log(error)
        return {
          allPage: 1,
          limit: 30,
          list: [],
          source,
          total: 0,
        }
      }))
    }
    return Promise.all(task).then((results: SearchResult[]) => {
      if (key != listInfo!.key) return []
      return setLists(results, page, text)
    })
  } else {
    if (listInfo?.key == key && listInfo?.list.length) return listInfo?.list
    listInfo!.noItemLabel = window.i18n.t('list__loading')
    listInfo!.key = key
    return music[sourceId].musicSearch.search(text, page, listInfo!.limit).then((data: SearchResult) => {
      if (key != listInfo!.key) return []
      return setList(data, page, text)
    }).catch((error: any) => {
      resetListInfo(sourceId)
      listInfo!.noItemLabel = window.i18n.t('list__load_failed')
      console.log(error)
      throw error
    })
  }
}

