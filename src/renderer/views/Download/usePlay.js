import { addTempPlayList } from '@renderer/store/player/action'
import { pause, play, playList } from '@renderer/core/player'
import { isPlay, playInfo, playMusicInfo } from '@renderer/store/player/state'
import { LIST_IDS } from '@common/constants'

export default ({ selectedList, list, listAll, removeAllSelect }) => {
  const handlePlayMusic = (index) => {
    const task = list.value[index]
    if (!task?.isComplate) return
    const targetIndex = listAll.value.indexOf(task)
    if (targetIndex < 0) return
    if (!playMusicInfo.isTempPlay && playInfo.playerListId == LIST_IDS.DOWNLOAD && playInfo.playerPlayIndex == targetIndex) {
      if (isPlay.value) pause()
      else play()
    } else playList(LIST_IDS.DOWNLOAD, targetIndex)
  }

  const handlePlayMusicLater = (index, single) => {
    if (selectedList.value.length && !single) {
      addTempPlayList(selectedList.value.map(s => ({ listId: LIST_IDS.DOWNLOAD, musicInfo: s })))
      removeAllSelect()
    } else {
      addTempPlayList([{ listId: LIST_IDS.DOWNLOAD, musicInfo: list.value[index] }])
    }
  }

  return {
    handlePlayMusic,
    handlePlayMusicLater,
  }
}
