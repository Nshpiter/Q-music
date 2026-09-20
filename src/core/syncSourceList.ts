// import { dateFormat } from '@/utils/common'
import { setListUpdateTime } from '@/utils/data'
import { overwriteListMusics, setFetchingListStatus } from './list'
import { getListDetailAll } from '@/core/songlist'
import { getListDetailAll as getBoardListAll } from '@/core/leaderboard'
import { openPlaylistSession } from './musicAccount/playlists'
import { parseAccountSourceId, syncAccountPlaylist } from './musicAccount/playlistSync'

const fetchList = async(id: string, source: LX.OnlineSource, sourceListId: string) => {
  setFetchingListStatus(id, true)

  let promise
  if (/^board__/.test(sourceListId)) {
    const id = sourceListId.replace(/^board__/, '')
    promise = id ? getBoardListAll(id, true) : Promise.reject(new Error('id not defined: ' + sourceListId))
  } else {
    promise = getListDetailAll(source, sourceListId, true)
  }
  return promise.finally(() => {
    setFetchingListStatus(id, false)
  })
}

export default async(targetListInfo: LX.List.UserListInfo) => {
  // console.log(targetListInfo)
  if (!targetListInfo.source || !targetListInfo.sourceListId) return
  const account = parseAccountSourceId(targetListInfo.sourceListId)
  if (account && (targetListInfo.source == 'tx' || targetListInfo.source == 'wy')) {
    const session = await openPlaylistSession(targetListInfo.source)
    if (session.owner != account.owner) throw new Error('account_changed')
    await syncAccountPlaylist(session, { id: account.id, name: targetListInfo.name }, undefined, targetListInfo)
    return
  }
  const list = await fetchList(targetListInfo.id, targetListInfo.source, targetListInfo.sourceListId)
  // console.log(list)
  await overwriteListMusics(targetListInfo.id, list)
  const now = Date.now()
  await setListUpdateTime(targetListInfo.id, now)
  // TODO
  // setUpdateTime(targetListInfo.id, dateFormat(now))
}
