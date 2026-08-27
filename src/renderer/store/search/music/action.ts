import { markRaw } from '@common/utils/vueTools'
import music from '@renderer/utils/musicSdk'
import { deduplicationList, toNewMusicInfo } from '@renderer/utils'
import { similar } from '@common/utils/common'
import { assertApiSupport } from '@renderer/store/utils'

import { sources, maxPages, listInfos } from './state'

interface SearchResult {
  list: LX.Music.MusicInfo[]
  allPage: number
  limit: number
  total: number
  source: LX.OnlineSource
}

const aggregateSources = new WeakMap<LX.Music.MusicInfo, LX.Music.MusicInfo[]>()

const normalizeText = (text: string) => text
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '')

const normalizeSinger = (singer: string) => singer
  .split(/[、,&/]+/)
  .map(normalizeText)
  .filter(Boolean)
  .sort()
  .join('')

const getAggregateKey = (musicInfo: LX.Music.MusicInfo) => {
  return `${normalizeText(musicInfo.name)}__${normalizeSinger(musicInfo.singer)}`
}

const mergeSourceResults = (list: LX.Music.MusicInfo[]) => {
  const groups = new Map<string, LX.Music.MusicInfo[]>()
  for (const item of deduplicationList(list)) {
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


/**
 * 按搜索关键词重新排序列表
 * @param list 歌曲列表
 * @param keyword 搜索关键词
 * @returns 排序后的列表
 */
const handleSortList = (list: LX.Music.MusicInfo[], keyword: string) => {
  const query = normalizeText(keyword)
  const variantPattern = /(?:翻唱|cover|remix|mix|live|现场|dj|伴奏|纯音乐|instrumental|加速|降速|女声版|男声版|片段|剪辑)/i
  return list
    .map((item, index) => {
      const name = normalizeText(item.name)
      const singer = normalizeText(item.singer)
      const albumName = item.meta.albumName ?? ''
      let score = similar(keyword, `${item.name} ${item.singer}`)
      if (name == query) score += 8
      else if (name.startsWith(query)) score += 4
      else if (name.includes(query)) score += 2
      if (singer == query) score += 2
      // 同名同歌手被多个平台同时返回时，通常更接近正式发行版本。
      score += Math.min(getAggregateSources(item).length, 3) * 2
      if (variantPattern.test(`${item.name} ${albumName}`)) score -= 3
      return { item, index, score }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item)
}


const setLists = (results: SearchResult[], page: number, text: string): LX.Music.MusicInfo[] => {
  let pages = []
  let totals = []
  let limit = 0
  let list = []
  for (const source of results) {
    maxPages[source.source] = source.allPage
    limit = Math.max(source.limit, limit)
    if (source.allPage < page) continue
    list.push(...source.list)
    pages.push(source.allPage)
    totals.push(source.total)
  }
  list = mergeSourceResults(list.map(s => markRaw(toNewMusicInfo(s))))
  let listInfo = listInfos.all
  listInfo.maxPage = Math.max(0, ...pages)
  const total = Math.max(0, ...totals)
  if (page == 1 || (total && list.length)) listInfo.total = total
  else listInfo.total = limit * page
  // listInfo.limit = limit
  listInfo.page = page
  listInfo.list = handleSortList(list, text)
  if (text && !list.length && page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
  else listInfo.noItemLabel = ''
  return listInfo.list
}

const setList = (datas: SearchResult, page: number, text: string): LX.Music.MusicInfo[] => {
  // console.log(datas.source, datas.list)
  let listInfo = listInfos[datas.source]!
  listInfo.list = handleSortList(deduplicationList(datas.list.map(s => markRaw(toNewMusicInfo(s)))), text)
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

