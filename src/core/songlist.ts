import songlistState, { type TagInfo, type ListDetailInfo, type ListInfo } from '@/store/songlist/state'
import songlistActions from '@/store/songlist/action'
import { createDetailCache } from './musicDetailPages'
import musicSdk from '@/utils/musicSdk'
import { withBrowseTimeout } from './browseRequest'


const cache = new Map<string, ListInfo>()
const listRequests = new Map<string, Promise<ListInfo>>()
const getDetailReader = createDetailCache<ListDetailInfo>(async(source, id, page) => {
  const provider = musicSdk[source]?.songList
  if (!provider) throw new Error('source not found')
  return withBrowseTimeout(provider.getListDetail(id, page) as Promise<ListDetailInfo>)
})

/**
 * 获取排序列表
 * @param source
 * @returns
 */
export const getSortList = (source: LX.OnlineSource) => {
  return songlistState.sortList[source]!
}

/**
 * 获取标签列表
 * @param source
 * @returns
 */
export const getTags = async<T extends LX.OnlineSource>(source: T) => {
  if (songlistState.tags[source]) return songlistState.tags[source] as TagInfo<T>
  const info = await withBrowseTimeout(musicSdk[source]?.songList.getTags() as Promise<TagInfo<T>>)
  songlistActions.setTags(info, source)
  return info
}

/**
 * 设置列表加载加载前的基本信息（用于加载失败后的重新加载）
 * @param source
 * @param tagId
 * @param sortId
 */
export const setListInfo: typeof songlistActions.setListInfo = (source, tagId, sortId) => {
  clearList()
  songlistActions.setListInfo(source, tagId, sortId)
}
/**
 * 设置列表信息
 * @param result
 * @param tagId
 * @param sortId
 * @param page
 * @returns
 */
export const setList: typeof songlistActions.setList = (result, tagId, sortId, page) => {
  return songlistActions.setList(result, tagId, sortId, page)
}

export const clearList = () => {
  songlistActions.clearList()
}

/**
 * 获取歌单列表
 * @param source 歌单源
 * @param tabId 类型id
 * @param sortId 排序
 * @param page 页数
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getList = async(source: LX.OnlineSource, tabId: string, sortId: string, page: number, isRefresh = false): Promise<ListInfo> => {
  let pageKey = `slist__${source}__${sortId}__${tabId}__${page}`

  const listCache = cache.get(pageKey)
  if (listCache) {
    if (isRefresh) cache.delete(pageKey)
    else return listCache
  }

  const request = withBrowseTimeout(musicSdk[source]?.songList.getList(sortId, tabId, page) as Promise<ListInfo>).then((result: ListInfo) => {
    if (!Array.isArray(result?.list) || !Number.isFinite(result.limit) || result.limit <= 0) throw new Error('Invalid song list response')
    if (listRequests.get(pageKey) === request) cache.set(pageKey, result)
    return result
    // if (pageKey != listInfo.key) return
    // setList(result, tabId, sortId, page)
  })
  listRequests.set(pageKey, request)
  try {
    return await request
  } finally {
    if (listRequests.get(pageKey) === request) listRequests.delete(pageKey)
  }
}


/**
 * 设置列表加载加载前的基本信息（用于加载失败后的重新加载）
 * @param source
 * @param tagId
 * @param sortId
 */
export const setListDetailInfo: typeof songlistActions.setListDetailInfo = (source, id) => {
  clearListDetail()
  songlistActions.setListDetailInfo(source, id)
}
export const setListDetail: typeof songlistActions.setListDetail = (result, id, page) => {
  return songlistActions.setListDetail(result, id, page)
}

export const clearListDetail = () => {
  songlistActions.clearListDetail()
}

/**
 * 获取歌单内单页歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetail = async(id: string, source: LX.OnlineSource, page: number, isRefresh = false): Promise<ListDetailInfo> => {
  return getDetailReader(source, id, isRefresh).getPage(page)
}

/**
 * 获取歌单内全部歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetailAll = async(source: LX.OnlineSource, id: string, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  return getDetailReader(source, id, isRefresh).getAll()
}
