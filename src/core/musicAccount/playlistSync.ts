import listState from '@/store/list/state'
import { createList, overwriteListMusics, setFetchingListStatus } from '@/core/list'
import { setListUpdateTime } from '@/utils/data'
import { assertPlaylistSession, getAccountPlaylistTracks, type AccountPlaylist, type PlaylistSession } from './playlists'

// 来源包含账号 ID，避免切换账号后将两个“我喜欢”写进同一个列表。
export const accountSourceId = (owner: string, id: string) => `account:${owner}:${id}`
export const parseAccountSourceId = (sourceId: string) => {
  const match = /^account:(\d+):((?:dir:)?\d+)$/.exec(sourceId)
  return match ? { owner: match[1], id: match[2] } : null
}
export const findAccountList = (session: PlaylistSession, id: string) => listState.userList.find(item => item.source == session.provider && item.sourceListId == accountSourceId(session.owner, id))
const pending = new Set<string>()

export const syncAccountPlaylist = async(session: PlaylistSession, playlist: Pick<AccountPlaylist, 'id' | 'name'>, signal?: AbortSignal, target?: LX.List.UserListInfo) => {
  const sourceListId = accountSourceId(session.owner, playlist.id)
  const key = `${session.provider}:${sourceListId}`
  if (pending.has(key)) throw new Error('busy')
  pending.add(key)
  const existing = target ?? findAccountList(session, playlist.id)
  const id = existing?.id ?? `account_${session.provider}_${session.owner}_${playlist.id.replace(':', '_')}`
  setFetchingListStatus(id, true)
  try {
    await assertPlaylistSession(session)
    const tracks = await getAccountPlaylistTracks(session, playlist.id, signal)
    await assertPlaylistSession(session)
    if (signal?.aborted) throw new Error('cancelled')
    // 所有分页都完整返回后才写入；失败、取消均保留原歌单。
    if (existing) {
      if (!listState.userList.some(item => item.id == id)) throw new Error('list_removed')
      await overwriteListMusics(id, tracks)
    } else {
      await createList({ id, name: playlist.name, source: session.provider, sourceListId, list: tracks })
    }
    await setListUpdateTime(id, Date.now())
    return { id, count: tracks.length }
  } finally {
    pending.delete(key)
    setFetchingListStatus(id, false)
  }
}
