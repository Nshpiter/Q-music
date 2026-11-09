import settingState from '@/store/setting/state'
import listState from '@/store/list/state'
import { addListMusics, getListMusics, removeListMusics } from '@/core/list'

export const getFavoriteListId = () => {
  const id = settingState.setting['list.favoriteTargetId']
  return id == listState.defaultList.id || listState.userList.some(list => list.id == id && !list.source) ? id : listState.loveList.id
}
const pending = new Map<string, Promise<boolean>>()
export const toggleLocalFavorite = async(track: LX.Music.MusicInfo) => {
  const listId = getFavoriteListId()
  const key = `${listId}:${track.source}:${track.id}`
  const existing = pending.get(key)
  if (existing) return existing
  const task = (async() => {
    const exists = (await getListMusics(listId)).some(item => item.id == track.id)
    if (exists) await removeListMusics(listId, [track.id])
    else await addListMusics(listId, [track], settingState.setting['list.addMusicLocationType'])
    return !exists
  })().finally(() => { pending.delete(key) })
  pending.set(key, task)
  return task
}
