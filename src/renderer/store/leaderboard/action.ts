// import { getLeaderboardSetting } from '@renderer/utils/data'
import { deduplicationList, toNewMusicInfo } from '@renderer/utils'
import musicSdk from '@renderer/utils/musicSdk'
import { markRaw, markRawList } from '@common/utils/vueTools'
import { boards, type Board, listDetailInfo, type ListDetailInfo } from './state'

const cache = new Map<string, any>()
const boardRequests = new Map<LX.OnlineSource, Promise<Board>>()
const detailRequests = new Map<string, Promise<ListDetailInfo>>()

const wait = async(ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const requestWithRetry = async<T>(factory: () => Promise<T>, validate: (result: T) => boolean, retryCount = 2): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const result = await factory()
      if (!validate(result)) throw new Error('Invalid leaderboard response')
      return result
    } catch (error) {
      lastError = error
      if (attempt == retryCount) break
      await wait(250 * (attempt + 1))
    }
  }
  throw lastError
}

export const setBoard = (board: Board, source: LX.OnlineSource) => {
  boards[source] = markRaw(board)
}

export const setListDetail = (result: ListDetailInfo, id: string, page: number) => {
  listDetailInfo.list = markRaw([...result.list])
  listDetailInfo.id = id
  listDetailInfo.source = result.source
  if (page == 1 || (result.total && result.list.length)) listDetailInfo.total = result.total
  else listDetailInfo.total = result.limit * page
  listDetailInfo.limit = result.limit
  listDetailInfo.page = page

  if (result.list.length) listDetailInfo.noItemLabel = ''
  else if (page == 1) listDetailInfo.noItemLabel = window.i18n.t('no_item')
}
export const clearListDetail = () => {
  listDetailInfo.list = []
  listDetailInfo.id = ''
  listDetailInfo.source = null
  listDetailInfo.total = 0
  listDetailInfo.limit = 30
  listDetailInfo.page = 1
  listDetailInfo.key = null
  listDetailInfo.noItemLabel = ''
}

export const getBoardsList = async(source: LX.OnlineSource) => {
  const pendingRequest = boardRequests.get(source)
  if (pendingRequest) return pendingRequest

  const leaderboard = musicSdk[source]?.leaderboard
  if (!leaderboard) throw new Error(`Leaderboard source not found: ${source}`)
  const request = requestWithRetry(
    async() => leaderboard.getBoards() as Promise<Board>,
    result => Array.isArray(result?.list) && result.list.length > 0,
  )

  boardRequests.set(source, request)
  try {
    return await request
  } finally {
    if (boardRequests.get(source) === request) boardRequests.delete(source)
  }
}

/**
 * 获取排行榜内单页歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetail = async(id: string, page: number, isRefresh = false): Promise<ListDetailInfo> => {
  // let [source, bangId] = tabId.split('__')
  // if (!bangId) return
  let key = `${id}__${page}`

  if (!isRefresh && cache.has(key)) return cache.get(key)

  const [source, bangId] = id.split('__') as [LX.OnlineSource, string]

  const pendingRequest = detailRequests.get(key)
  if (pendingRequest) return pendingRequest

  const leaderboard = musicSdk[source]?.leaderboard
  if (!leaderboard) throw new Error(`Leaderboard source not found: ${source}`)

  const request = requestWithRetry(
    async() => leaderboard.getList(bangId, page) as Promise<ListDetailInfo>,
    result => Array.isArray(result?.list) && Number.isFinite(result?.limit),
  ).then((result: ListDetailInfo) => {
    result.list = markRawList(deduplicationList(result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]))
    cache.set(key, result)
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
 * 获取排行榜内全部歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetailAll = async(id: string, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  const [source, bangId] = id.split('__') as [LX.OnlineSource, string]
  // console.log(source, id)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const loadData = async(id: string, page: number): Promise<ListDetailInfo> => {
    let key = `${source}__${id}__${page}`
    if (!isRefresh && cache.has(key)) return cache.get(key)

    const leaderboard = musicSdk[source]?.leaderboard
    if (!leaderboard) throw new Error('source not found' + source)
    return requestWithRetry(
      async() => leaderboard.getList(id, page) as Promise<ListDetailInfo>,
      result => Array.isArray(result?.list) && Number.isFinite(result?.limit),
    ).then((result: ListDetailInfo) => {
      result.list = markRawList(deduplicationList(result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]))
      cache.set(key, result)
      return result
    })
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return loadData(bangId, 1).then((result: ListDetailInfo) => {
    if (result.total <= result.limit) return result.list

    let maxPage = Math.ceil(result.total / result.limit)
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const loadDetail = (loadPage = 2): Promise<ListDetailInfo['list']> => {
      return loadPage == maxPage
        ? loadData(bangId, loadPage).then((result: ListDetailInfo) => result.list)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        : loadData(bangId, loadPage).then((result1: ListDetailInfo) => loadDetail(++loadPage).then((result2: ListDetailInfo['list']) => [...result1.list, ...result2]))
    }
    return loadDetail().then(result2 => [...result.list, ...result2])
  }).then((list: ListDetailInfo['list']) => deduplicationList(list))
}


/**
 * 获取并设置排行榜内单页歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getAndSetListDetail = async(id: string, page: number, isRefresh = false) => {
  // let [source, bangId] = tabId.split('__')
  // if (!bangId) return
  let key = `${id}__${page}`

  if (!isRefresh && listDetailInfo.key == key && listDetailInfo.list.length) return

  listDetailInfo.key = key
  listDetailInfo.noItemLabel = window.i18n.t('list__loading')

  return getListDetail(id, page, isRefresh).then((result: ListDetailInfo) => {
    if (key != listDetailInfo.key) return
    setListDetail(result, id, page)
  }).catch((error: any) => {
    if (key != listDetailInfo.key) return
    clearListDetail()
    listDetailInfo.noItemLabel = window.i18n.t('list__load_failed')
    console.log(error)
    throw error
  })
}
