import leaderboardState, { type Board, type ListDetailInfo } from '@/store/leaderboard/state'
import leaderboardActions from '@/store/leaderboard/action'
import { createDetailCache } from './musicDetailPages'
import musicSdk from '@/utils/musicSdk'
import { withBrowseTimeout } from './browseRequest'

/**
 * 获取排行榜内单页歌曲
 * @param id 排行榜id  {souce}__{bangId}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const setListDetailInfo = (id: string) => {
  clearListDetail()
  const [source] = id.split('__') as [LX.OnlineSource, string]
  leaderboardActions.setListDetailInfo(source, id)
}
export const setListDetail = (result: ListDetailInfo, id: string, page: number) => {
  return leaderboardActions.setListDetail(result, id, page)
}

export const clearListDetail = () => {
  leaderboardActions.clearListDetail()
}

const setBoard = (board: Board, source: LX.OnlineSource) => {
  leaderboardActions.setBoard(board, source)
}

const RETRY_DELAYS = [250, 500]

const requestWithRetry = async<T>(request: () => Promise<T>, validate: (result: T) => boolean): Promise<T> => {
  const deadline = Date.now() + 20_000
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new Error('Browse request timed out')
      const result = await withBrowseTimeout(request(), remaining)
      if (!validate(result)) throw new Error('invalid leaderboard response')
      return result
    } catch (error) {
      lastError = error
      if (Date.now() >= deadline) break
      if (attempt < RETRY_DELAYS.length) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]))
      }
    }
  }
  throw lastError
}

export const getBoardsList = async(source: LX.OnlineSource) => {
  // const source = (await getLeaderboardSetting()).source as LX.OnlineSource
  if (leaderboardState.boards[source]) return leaderboardState.boards[source].list
  const leaderboard = musicSdk[source]?.leaderboard
  if (!leaderboard) throw new Error('source not found')
  const board = await requestWithRetry(
    async() => leaderboard.getBoards() as Promise<Board>,
    result => Array.isArray(result?.list) && result.list.length > 0,
  )
  setBoard(board, source)
  return leaderboardState.boards[source]!.list
}

const getDetailReader = createDetailCache<ListDetailInfo>(async(source, bangId, page) => {
  const leaderboard = musicSdk[source]?.leaderboard
  if (!leaderboard) throw new Error('source not found')
  return requestWithRetry(
    async() => leaderboard.getList(bangId, page) as Promise<ListDetailInfo>,
    result => Array.isArray(result?.list) && Number.isFinite(result?.total) && Number.isFinite(result?.limit),
  )
})

/**
 * 获取排行榜内单页歌曲
 * @param id 排行榜id  {souce}__{bangId}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetail = async(id: string, page: number, isRefresh = false): Promise<ListDetailInfo> => {
  const [source, bangId] = id.split('__') as [LX.OnlineSource, string]
  return getDetailReader(source, bangId, isRefresh).getPage(page)
}

/**
 * 获取排行榜内全部歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetailAll = async(id: string, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  const [source, bangId] = id.split('__') as [LX.OnlineSource, string]
  return getDetailReader(source, bangId, isRefresh).getAll()
}

/**
 * 获取并设置排行榜内单页歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
// export const getAndSetListDetail = async(id: string, page: number, isRefresh = false) => {
//   // let [source, bangId] = tabId.split('__')
//   // if (!bangId) return
//   let key = `${id}__${page}`

//   if (!isRefresh && leaderboardState.listDetailInfo.key == key && leaderboardState.listDetailInfo.list.length) return

//   leaderboardState.listDetailInfo.key = key

//   return getListDetail(id, page, isRefresh).then((result: ListDetailInfo) => {
//     if (key != leaderboardState.listDetailInfo.key) return
//     setListDetail(result, id, page)
//   }).catch((error: any) => {
//     clearListDetail()
//     console.log(error)
//     throw error
//   })
// }
