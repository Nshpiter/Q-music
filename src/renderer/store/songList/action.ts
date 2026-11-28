// import { getSongListSetting } from '@renderer/utils/data'
import { deduplicationList, toNewMusicInfo } from '@renderer/utils'
import musicSdk from '@renderer/utils/musicSdk'
import { markRaw, markRawList } from '@common/utils/vueTools'
import { withBrowseTimeout } from '../browseRequest'
import {
  tags,
  listInfo,
  listDetailInfo,
  selectListInfo,
  isVisibleListDetail,
  openSongListInputInfo,
} from './state'
import type {
  ListDetailInfo,
  ListInfoItem,
  ListInfo,
  TagInfo,
} from './state'

const cache = new Map<string, any>()
const tagRequests = new Map<LX.OnlineSource, Promise<TagInfo>>()
const detailRequests = new Map<string, Promise<ListDetailInfo>>()
let listRevision = 0
let detailRevision = 0

const wait = async(ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const requestWithRetry = async<T>(factory: () => Promise<T>, validate: (result: T) => boolean, retryCount = 2, isCurrent = () => true): Promise<T> => {
  const deadline = Date.now() + 20_000
  let lastError: unknown
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      if (!isCurrent()) throw new Error('Browse request superseded')
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new Error('Browse request timed out')
      const result = await withBrowseTimeout(factory(), remaining)
      if (!validate(result)) throw new Error('Invalid song list response')
      return result
    } catch (error) {
      lastError = error
      if (error instanceof Error && ['login_required', 'verification_required', 'invalid_link', 'cancelled'].includes(error.message)) break
      if (!isCurrent() || attempt == retryCount || Date.now() >= deadline) break
      await wait(250 * (attempt + 1))
    }
  }
  throw lastError
}

const isListResponse = (result: unknown): result is ListInfo => {
  const value = result as Partial<ListInfo> | null | undefined
  return Array.isArray(value?.list) && Number.isFinite(value?.limit)
}
const isListDetailResponse = (result: unknown): result is ListDetailInfo => {
  const value = result as Partial<ListDetailInfo> | null | undefined
  return Array.isArray(value?.list) && Number.isFinite(value?.limit)
}

export const setTags = (tagInfo: TagInfo, source: LX.OnlineSource) => {
  tags[source] = markRaw(tagInfo)
}

export const clearList = () => {
  listRevision++
  listInfo.list = []
  listInfo.total = 0
  listInfo.noItemLabel = ''
  listInfo.page = 1
  listInfo.key = ''
}

export const setList = (result: ListInfo, tagId: string, sortId: string, page: number) => {
  listInfo.list = markRaw([...result.list])
  if (page == 1 || result.total || !result.list.length) listInfo.total = result.total ?? 0
  else listInfo.total = result.limit * page
  listInfo.limit = result.limit
  listInfo.page = page
  listInfo.source = result.source
  listInfo.tagId = tagId
  listInfo.sortId = sortId
  listInfo.noItemLabel = result.list.length ? '' : window.i18n.t('no_item')
}
export const setListDetail = (result: ListDetailInfo, id: string, page: number) => {
  listDetailInfo.list = markRaw([...result.list])
  listDetailInfo.id = id
  listDetailInfo.source = result.source
  if (page == 1 || result.total || !result.list.length) listDetailInfo.total = result.total ?? 0
  else listDetailInfo.total = result.limit * page
  listDetailInfo.limit = result.limit
  listDetailInfo.page = page
  listDetailInfo.info = markRaw({ ...result.info })
  listDetailInfo.noItemLabel = result.list.length ? '' : window.i18n.t('no_item')
}

export const setSelectListInfo = (info: ListInfoItem) => {
  selectListInfo.author = info.author
  selectListInfo.desc = info.desc
  selectListInfo.id = info.id
  selectListInfo.img = info.img
  selectListInfo.name = info.name
  selectListInfo.play_count = info.play_count
  selectListInfo.source = info.source
}
export const clearListDetail = () => {
  detailRevision++
  listDetailInfo.list = []
  listDetailInfo.id = ''
  listDetailInfo.source = 'kw'
  listDetailInfo.total = 0
  listDetailInfo.limit = 30
  listDetailInfo.page = 1
  listDetailInfo.key = null
  listDetailInfo.info = {}
  listDetailInfo.noItemLabel = ''
}

export const getTags = async<T extends LX.OnlineSource>(source: T) => {
  const pendingRequest = tagRequests.get(source)
  if (pendingRequest) return pendingRequest as Promise<TagInfo<T>>

  const pending = musicSdk[source]?.songList.getTags() as Promise<TagInfo<T>> | undefined
  if (!pending) throw new Error(`Song list source not found: ${source}`)
  const request = withBrowseTimeout(pending)

  tagRequests.set(source, request)
  try {
    return await request
  } finally {
    if (tagRequests.get(source) === request) tagRequests.delete(source)
  }
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
export const getAndSetList = async(source: LX.OnlineSource, tabId: string, sortId: string, page: number, isRefresh = false) => {
  const revision = ++listRevision
  // let source = rootState.setting.songList.source
  // let tabId = rootState.setting.songList.tagInfo.id
  // let sortId = rootState.setting.songList.sortId
  // console.log(sortId)
  let key = `slist__${source}__${sortId}__${tabId}__${page}`
  // if (state.list.list.length && state.list.key == key) return
  if (!isRefresh) {
    if (listInfo.key == key && listInfo.list.length && !listInfo.noItemLabel) return
    if (cache.has(key)) {
      listInfo.key = key
      setList(cache.get(key), tabId, sortId, page)
      return
    }
  }
  listInfo.noItemLabel = window.i18n.t('list__loading')
  listInfo.list = []
  listInfo.total = 0
  listInfo.source = source
  listInfo.tagId = tabId
  listInfo.sortId = sortId
  listInfo.page = page
  listInfo.key = key
  // clearList()
  return withBrowseTimeout(requestWithRetry(
    async() => musicSdk[source]?.songList.getList(sortId, tabId, page) as Promise<ListInfo>,
    isListResponse,
    2,
    () => revision == listRevision,
  )).then((result: ListInfo) => {
    if (revision != listRevision) return
    cache.set(key, result)
    setList(result, tabId, sortId, page)
  }).catch((error: any) => {
    if (revision != listRevision) return
    listRevision++
    listInfo.noItemLabel = window.i18n.t('list__load_failed')
    console.log(error)
    throw error
  })
}

/**
 * 获取歌单内单页歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetail = async(id: string, source: LX.OnlineSource, page: number, isRefresh = false): Promise<ListDetailInfo> => {
  let key = `sdetail__${source}__${id}__${page}`
  if (!isRefresh && cache.has(key)) return cache.get(key)
  const pending = detailRequests.get(key)
  if (!isRefresh && pending) return pending

  const request = withBrowseTimeout(requestWithRetry(
    async() => musicSdk[source]?.songList.getListDetail(id, page) as Promise<ListDetailInfo>,
    isListDetailResponse,
  )).then((result: ListDetailInfo) => {
    result.list = markRawList(deduplicationList(result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]))
    if (detailRequests.get(key) === request) cache.set(key, result)
    return result
  })
  detailRequests.set(key, request)
  try {
    return await request
  } finally {
    if (detailRequests.get(key) === request) detailRequests.delete(key)
  }
}

/**
 * 获取歌单内全部歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetailAll = async(id: string, source: LX.OnlineSource, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  // console.log(source, id)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const loadData = (id: string, page: number): Promise<ListDetailInfo> => {
    let key = `sdetail__${source}__${id}__${page}`
    if (isRefresh && cache.has(key)) cache.delete(key)
    const result = cache.has(key)
      ? Promise.resolve(cache.get(key))
      : requestWithRetry(
        async() => musicSdk[source]?.songList.getListDetail(id, page) as Promise<ListDetailInfo>,
        isListDetailResponse,
      ).then((result: ListDetailInfo) => {
        result.list = markRawList(deduplicationList(result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]))
        cache.set(key, result)
        return result
      })
    return result.then(info => {
      if (info.incomplete) throw new Error('incomplete')
      return info
    })
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return loadData(id, 1).then((result: ListDetailInfo) => {
    if (result.total <= result.limit) return result.list

    let maxPage = Math.ceil(result.total / result.limit)
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const loadDetail = (loadPage = 2): Promise<ListDetailInfo['list']> => {
      return loadPage == maxPage
        ? loadData(id, loadPage).then((result: ListDetailInfo) => result.list)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        : loadData(id, loadPage).then((result1: ListDetailInfo) => loadDetail(++loadPage).then((result2: ListDetailInfo['list']) => [...result1.list, ...result2]))
    }
    return loadDetail().then(result2 => [...result.list, ...result2])
  }).then((list: ListDetailInfo['list']) => deduplicationList(list))
}


/**
 * 获取并设置歌单内单页歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getAndSetListDetail = async(id: string, source: LX.OnlineSource, page: number, isRefresh = false) => {
  let key = `sdetail__${source}__${id}__${page}`

  if (!isRefresh && listDetailInfo.key == key && listDetailInfo.list.length && !listDetailInfo.noItemLabel) return
  const revision = ++detailRevision
  if (listDetailInfo.id != id || listDetailInfo.source != source) listDetailInfo.info = {}
  listDetailInfo.list = []
  listDetailInfo.total = 0
  listDetailInfo.id = id
  listDetailInfo.source = source
  listDetailInfo.page = page

  listDetailInfo.key = key
  listDetailInfo.noItemLabel = window.i18n.t('list__loading')

  return withBrowseTimeout(getListDetail(id, source, page, isRefresh)).then((result: ListDetailInfo) => {
    if (revision != detailRevision) return
    setListDetail(result, id, page)
  }).catch((error: any) => {
    if (revision != detailRevision) return
    detailRevision++
    listDetailInfo.noItemLabel = window.i18n.t('list__load_failed')
    console.log(error)
    throw error
  })
}

export const setVisibleListDetail = (visible: boolean) => {
  isVisibleListDetail.value = visible
}

export const setOpenSongListInputInfo = (text: string, source: string) => {
  openSongListInputInfo.text = text
  openSongListInputInfo.source = source
}
