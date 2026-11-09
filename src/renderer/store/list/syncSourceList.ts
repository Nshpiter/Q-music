import { reactive } from '@common/utils/vueTools'
import { getListUpdateInfo, setListSourceAccount, setListSourceSnapshot, setListUpdateTime } from '@renderer/utils/data'
import { createSourceSnapshot, mergeSourcePlaylist } from '@common/utils/playlistMerge'
import { setFetchingListStatus, overwriteListMusics, getListMusics } from './action'
import { userLists } from './state'
import { getListDetailAll } from '@renderer/store/songList/action'
import { getListDetailAll as getBoardListAll } from '@renderer/store/leaderboard/action'
import { bilibiliClient } from '@renderer/utils/musicSdk/bi'
import { toNewMusicInfo } from '@renderer/utils'

export const listSyncStates = reactive<Record<string, { phase: 'fetch' | 'save' | 'success' | 'error', current: number, total: number, error?: string }>>({})
const pending = new Map<string, Promise<boolean>>()
export const isQQSyncList = (list: LX.List.UserListInfo) => list.source == 'tx' && !!list.sourceListId && !list.sourceListId.startsWith('board__')

export const syncErrorKey = (error: unknown) => {
  const code = error instanceof Error ? error.message : ''
  if (code == 'verification_required') return 'kugou__verification_required'
  if (code == 'playlist_incomplete' || code == 'incomplete') return 'list_sync_incomplete'
  return code == 'account_changed' ? 'list_sync_account_changed' : code == 'login_required' ? 'list_sync_login_required' : 'list_sync_failed'
}

const performSync = async(target: LX.List.UserListInfo, automatic: boolean) => {
  const { id, source, sourceListId } = target
  if (!source || !sourceListId) return false
  const settings = (await getListUpdateInfo())[id]
  if (automatic && !settings?.isAutoUpdate) return false
  if (automatic && isQQSyncList(target) && !settings?.sourceAccountId) return false
  const stillLinked = () => userLists.some(list => list.id == id && list.source == source && list.sourceListId == sourceListId)
  if (!stillLinked()) return false
  setFetchingListStatus(id, true)
  listSyncStates[id] = { phase: 'fetch', current: 0, total: 0 }
  try {
    let list: LX.Music.MusicInfo[]
    let accountId: string | undefined
    if (source == 'bi') {
      const result = await bilibiliClient.importCollection(sourceListId, (current, total) => {
        listSyncStates[id] = { phase: 'fetch', current, total }
      }, () => !stillLinked())
      list = result.list.map(item => toNewMusicInfo(item as unknown as LX.Music.MusicInfoOnline))
    } else if (sourceListId.startsWith('board__')) {
      list = await getBoardListAll(sourceListId.replace(/^board__/, ''), true)
    } else if (source == 'tx' || source == 'wy' || (source == 'kg' && /^account:\d+:\d+$/.test(sourceListId))) {
      const { loadAccountPlaylistMusic } = await import('@renderer/views/List/MyList/importPlaylist')
      list = await loadAccountPlaylistMusic(source, sourceListId, progress => {
        listSyncStates[id] = { ...progress, phase: 'fetch' }
      }, () => !stillLinked(), {
        existingMusic: await getListMusics(id),
        accountId: settings?.sourceAccountId,
        onAccount: value => { accountId = value },
      }).catch(async(error: Error) => {
        // 旧的网易云公开歌单没有账号绑定，未登录时仍允许按公开链接同步。
        if (source == 'wy' && !settings?.sourceAccountId && error.message == 'login_required') return getListDetailAll(sourceListId, source, true)
        throw error
      })
    } else {
      list = await getListDetailAll(sourceListId, source, true)
    }
    if (!stillLinked()) return false
    // 自动更新在保存前再次检查开关，用户中途关闭后不再覆盖本地。
    if (automatic && !(await getListUpdateInfo())[id]?.isAutoUpdate) return false
    listSyncStates[id] = { phase: 'save', current: list.length, total: list.length }
    // 保存前重新读本地列表，保留抓取期间手动追加的歌曲。
    const sourceKey = `${source}:${sourceListId}`
    const current = await getListMusics(id)
    if (!stillLinked()) return false
    await overwriteListMusics({ listId: id, musicInfos: mergeSourcePlaylist(current, list, sourceKey, settings?.sourceSnapshot) })
    await setListSourceSnapshot(id, createSourceSnapshot(sourceKey, list))
    if (accountId) await setListSourceAccount(id, accountId)
    await setListUpdateTime(id, Date.now())
    listSyncStates[id] = { phase: 'success', current: list.length, total: list.length }
    return true
  } catch (error) {
    listSyncStates[id] = { phase: 'error', current: 0, total: 0, error: syncErrorKey(error) }
    throw error
  } finally {
    setFetchingListStatus(id, false)
    if (listSyncStates[id]?.phase == 'fetch' || listSyncStates[id]?.phase == 'save') Reflect.deleteProperty(listSyncStates, id)
  }
}

// 抓取和保存共用同一把锁，多个入口同时刷新时只提交一次。
const syncSourceList = async(target: LX.List.UserListInfo, automatic = false): Promise<boolean> => {
  const running = pending.get(target.id)
  if (running) return running
  const task = performSync(target, automatic).finally(() => { pending.delete(target.id) })
  pending.set(target.id, task)
  return task
}

// 收藏可能发生在旧快照抓取期间，先等待旧任务，再读取收藏后的新快照。
export const syncQQFavorites = async(accountId: string) => {
  const info = await getListUpdateInfo()
  const targets = userLists.filter(list => isQQSyncList(list) && ['dir:201', '0'].includes(list.sourceListId ?? '') && info[list.id]?.isAutoUpdate && info[list.id]?.sourceAccountId == accountId)
  const results = await Promise.allSettled(targets.map(async list => {
    await pending.get(list.id)?.catch(() => {})
    return syncSourceList(list, true)
  }))
  return { total: results.filter(result => result.status == 'rejected' || result.value).length, failed: results.filter(result => result.status == 'rejected').length }
}

export default syncSourceList
