import { tempListMeta, userLists } from '@renderer/store/list/state'
import { dialog } from '@renderer/plugins/Dialog'
import syncSourceList from '@renderer/store/list/syncSourceList'
import { getListDetail, getListDetailAll } from '@renderer/store/leaderboard/action'
import { createUserList, setTempList } from '@renderer/store/list/action'
import { appSetting } from '@renderer/store/setting'
import { playAllFromLoader } from '@renderer/core/player/selection'
import { playList } from '@renderer/core/player/action'
import { LIST_IDS } from '@common/constants'
import { toMD5 } from '@renderer/utils'

const getListId = (id: string) => `board__${id}`
let playRequestId = 0

export const addSongListDetail = async(id: string, name: string, source: LX.OnlineSource) => {
  // console.log(this.listDetail.info)
  // if (!this.listDetail.info.name) return
  const listId = getListId(id)
  const targetList = userLists.find(l => l.sourceListId == listId)
  if (targetList) {
    const confirm = await dialog.confirm({
      message: window.i18n.t('duplicate_list_tip', { name: targetList.name }),
      cancelButtonText: window.i18n.t('lists__import_part_button_cancel'),
      confirmButtonText: window.i18n.t('confirm_button_text'),
    })
    if (!confirm) return
    void syncSourceList(targetList)
    return
  }

  const list = await getListDetailAll(id)
  await createUserList({
    name,
    id: `${source}_${toMD5(listId)}`,
    list,
    source,
    sourceListId: listId,
  })
}

export const playSongListDetail = async(id: string, list?: LX.Music.MusicInfoOnline[], index?: number) => {
  if (index == null && appSetting['list.playAllMode'] == 'append') return playAllFromLoader(getListId(id), async() => getListDetailAll(id))
  index ??= 0
  const requestId = ++playRequestId
  let isPlayingList = false
  // console.log(list)
  const listId = getListId(id)
  if (!list?.length) list = (await getListDetail(id, 1)).list
  if (requestId != playRequestId) return
  if (list?.length) {
    await setTempList(listId, [...list])
    if (requestId != playRequestId || tempListMeta.id != listId) return
    playList(LIST_IDS.TEMP, index)
    isPlayingList = true
  }
  const fullList = await getListDetailAll(id)
  if (requestId != playRequestId) return
  if (!fullList.length) return
  if (isPlayingList) {
    if (tempListMeta.id == listId) {
      await setTempList(listId, [...fullList])
    }
  } else {
    await setTempList(listId, [...fullList])
    playList(LIST_IDS.TEMP, index)
  }
}
