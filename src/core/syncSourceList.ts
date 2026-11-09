// import { dateFormat } from '@/utils/common'
import { getListUpdateInfo, setListSourceSnapshot, setListUpdateTime } from '@/utils/data'
import { getListMusics, overwriteListMusics, setFetchingListStatus } from './list'
import { createSourceSnapshot, mergeSourcePlaylist } from '@/utils/playlistMerge'
import { getListDetailAll } from '@/core/songlist'
import { getListDetailAll as getBoardListAll } from '@/core/leaderboard'
import { openPlaylistSession } from './musicAccount/playlists'
import { parseAccountSourceId, syncAccountPlaylist } from './musicAccount/playlistSync'
import listState from '@/store/list/state'
import { setPlaylistSyncState } from './musicAccount/syncState'
import { bilibiliClient } from '@/utils/musicSdk/bi'
import { toNewMusicInfo } from '@/utils'

const fetchList = async(id: string, source: LX.OnlineSource, sourceListId: string) => {
  setFetchingListStatus(id, true)

  let promise
  if (source == 'bi') {
    const stillLinked = () => listState.userList.some(item => item.id == id && item.source == source && item.sourceListId == sourceListId)
    promise = bilibiliClient.importCollection(sourceListId, undefined, () => !stillLinked())
      .then(result => result.list.map(item => toNewMusicInfo(item as unknown as LX.Music.MusicInfoOnline)))
  } else if (/^board__/.test(sourceListId)) {
    const id = sourceListId.replace(/^board__/, '')
    promise = id ? getBoardListAll(id, true) : Promise.reject(new Error('id not defined: ' + sourceListId))
  } else {
    promise = getListDetailAll(source, sourceListId, true)
  }
  return promise.finally(() => {
    setFetchingListStatus(id, false)
  })
}

const performSync = async(targetListInfo: LX.List.UserListInfo, automatic = false) => {
  // console.log(targetListInfo)
  if (!targetListInfo.source || !targetListInfo.sourceListId) return
  const settings = (await getListUpdateInfo())[targetListInfo.id]
  if (automatic && (!settings?.isAutoUpdate || (targetListInfo.source == 'tx' && !settings.sourceAccountId))) return
  const account = parseAccountSourceId(targetListInfo.sourceListId)
  if (account && (targetListInfo.source == 'tx' || targetListInfo.source == 'wy' || targetListInfo.source == 'kg')) {
    const session = await openPlaylistSession(targetListInfo.source)
    if (session.owner != account.owner) throw new Error('account_changed')
    await syncAccountPlaylist(session, { id: account.id, name: targetListInfo.name }, undefined, targetListInfo, automatic)
    return
  }
  const stillLinked = () => listState.userList.some(item => item.id == targetListInfo.id && item.source == targetListInfo.source && item.sourceListId == targetListInfo.sourceListId)
  if (!stillLinked()) return
  const list = await fetchList(targetListInfo.id, targetListInfo.source, targetListInfo.sourceListId)
  if (!stillLinked() || (automatic && !(await getListUpdateInfo())[targetListInfo.id]?.isAutoUpdate)) return
  // console.log(list)
  const sourceKey = `${targetListInfo.source}:${targetListInfo.sourceListId}`
  const current = await getListMusics(targetListInfo.id)
  if (!stillLinked()) return
  await overwriteListMusics(targetListInfo.id, mergeSourcePlaylist(current, list, sourceKey, settings?.sourceSnapshot))
  await setListSourceSnapshot(targetListInfo.id, createSourceSnapshot(sourceKey, list))
  const now = Date.now()
  await setListUpdateTime(targetListInfo.id, now)
  // TODO
  // setUpdateTime(targetListInfo.id, dateFormat(now))
}

const pending = new Map<string, Promise<void>>()
export const waitForSourceListSync = async(id: string) => {
  await pending.get(id)?.catch(() => {})
}
export default async(target: LX.List.UserListInfo, automatic = false) => {
  const running = pending.get(target.id)
  if (running) return running
  const task = performSync({ ...target }, automatic).catch(error => {
    // 打开账号会话就失败时也要更新状态，不能遗留上一次“同步成功”。
    setPlaylistSyncState(target.id, { phase: 'error', current: 0, total: 0, error: error instanceof Error ? error.message : 'unavailable' })
    throw error
  }).finally(() => { pending.delete(target.id) })
  pending.set(target.id, task)
  return task
}
