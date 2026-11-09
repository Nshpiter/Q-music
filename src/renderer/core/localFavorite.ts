import { appSetting } from '@renderer/store/setting'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { addListMusics, checkListExistMusic, removeListMusics } from '@renderer/store/list/action'

export const getFavoriteListId = () => {
  const id = appSetting['list.favoriteTargetId']
  return id == defaultList.id || userLists.some(list => list.id == id && !list.source) ? id : loveList.id
}
const pending = new Map<string, Promise<boolean>>()
export const toggleLocalFavorite = async(track: LX.Music.MusicInfo) => {
  const listId = getFavoriteListId()
  const key = `${listId}:${track.source}:${track.id}`
  const existing = pending.get(key)
  if (existing) return existing
  const task = (async() => {
    const exists = await checkListExistMusic(listId, track.id)
    if (exists) await removeListMusics({ listId, ids: [track.id] })
    else await addListMusics(listId, [track])
    return !exists
  })().finally(() => { pending.delete(key) })
  pending.set(key, task)
  return task
}
