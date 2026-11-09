import { addListMusics } from '@renderer/store/list/action'
import { LIST_IDS } from '@common/constants'
import { dialog } from '@renderer/plugins/Dialog'
import { addTempPlayList } from '@renderer/store/player/action'
import { playFromList, playAllFromList } from '@renderer/core/player/selection'

export default ({ props, selectedList, list, removeAllSelect }) => {
  let clickTime = 0
  let clickIndex = -1

  const handlePlayMusic = (index) => {
    return playFromList(props.listId, index)
  }

  const handlePlayMusicLater = (index, single) => {
    if (selectedList.value.length && !single) {
      addTempPlayList(selectedList.value.map(s => ({ listId: props.listId, musicInfo: s })))
      removeAllSelect()
    } else {
      addTempPlayList([{ listId: props.listId, musicInfo: list.value[index] }])
    }
  }

  const doubleClickPlay = index => {
    if (
      window.performance.now() - clickTime > 400 ||
      clickIndex !== index
    ) {
      clickTime = window.performance.now()
      clickIndex = index
      return
    }
    handlePlayMusic(index, true)
    clickTime = 0
    clickIndex = -1
  }

  const handleSaveAudition = async() => {
    try {
      await addListMusics(LIST_IDS.DEFAULT, selectedList.value.length ? selectedList.value : list.value)
      removeAllSelect()
      await dialog({ message: window.i18n.t('queue_save_audition_done') })
    } catch { await dialog({ message: window.i18n.t('list_add__action_failed') }) }
  }
  return {
    handleSaveAudition,
    handlePlayAll: () => playAllFromList(props.listId),
    handlePlayMusic,
    handlePlayMusicLater,
    doubleClickPlay,
  }
}
