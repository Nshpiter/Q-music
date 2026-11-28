// import { useCommit } from '@common/utils/vueTools'
import { defaultList } from '@renderer/store/list/state'
import { getListMusics, addListMusics } from '@renderer/store/list/action'
import { addTempPlayList } from '@renderer/store/player/action'
import { type Ref } from '@common/utils/vueTools'
import { playList } from '@renderer/core/player'
import { LIST_IDS } from '@common/constants'

export default ({ selectedList, props, removeAllSelect, emit }: {
  selectedList: Ref<LX.Music.MusicInfoOnline[]>
  props: {
    list: LX.Music.MusicInfoOnline[]
    playInContext?: boolean
  }
  removeAllSelect: () => void
  emit: (event: 'show-menu' | 'play-list' | 'togglePage', ...args: any[]) => void
}) => {
  let clickTime = 0
  let clickIndex = -1

  const handlePlayMusic = async(index: number, single: boolean) => {
    const targetSong = props.list[index]
    if (!targetSong) return
    if (single || !selectedList.value.length) {
      emit('play-list', index)
      return
    }
    if (selectedList.value.length && !single) {
      await addListMusics(defaultList.id, [...selectedList.value])
      removeAllSelect()
    } else {
      await addListMusics(defaultList.id, [targetSong])
    }
    const defaultListMusics = await getListMusics(defaultList.id)
    const targetIndex = defaultListMusics.findIndex(s => s.id === targetSong.id && s.source === targetSong.source)
    if (targetIndex > -1) {
      playList(defaultList.id, targetIndex)
    }
  }

  const handlePlayMusicNext = (index: number, single: boolean) => {
    if (selectedList.value.length && !single) {
      addTempPlayList(selectedList.value.map(s => ({ listId: LIST_IDS.PLAY_LATER, musicInfo: s, isTop: true })))
      removeAllSelect()
    } else if (props.list[index]) {
      addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo: props.list[index], isTop: true }])
    }
  }

  const handlePlayMusicLater = (index: number, single: boolean) => {
    if (selectedList.value.length && !single) {
      addTempPlayList(selectedList.value.map(s => ({ listId: LIST_IDS.PLAY_LATER, musicInfo: s })))
      removeAllSelect()
    } else if (props.list[index]) {
      addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo: props.list[index] }])
    }
  }

  const doubleClickPlay = (index: number) => {
    if (
      window.performance.now() - clickTime > 400 ||
      clickIndex !== index
    ) {
      clickTime = window.performance.now()
      clickIndex = index
      return
    }
    void handlePlayMusic(index, true)
    clickTime = 0
    clickIndex = -1
  }

  return {
    handlePlayMusic,
    handlePlayMusicNext,
    handlePlayMusicLater,
    doubleClickPlay,
  }
}
