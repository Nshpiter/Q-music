import { computed, ref, shallowReactive, reactive, nextTick, watch } from '@common/utils/vueTools'
import musicSdk from '@renderer/utils/musicSdk'
import { useI18n } from '@renderer/plugins/i18n'
import { DOWNLOAD_STATUS } from '@common/constants'

export default ({
  isSelectionMode,
  selectedList,
  selectFromMenu,
  list,
  activeTab,
  handleStartTask,
  handlePauseTask,
  handleRemoveTask,
  handleOpenFile,
  handlePlayMusic,
  handlePlayMusicNext,
  handlePlayMusicLater,
  handleShowMusicAddModal,
  handleSearch,
  handleOpenMusicDetail,
}) => {
  const itemMenuControl = reactive({
    play: true,
    playNext: true,
    playLater: true,
    addTo: true,
    start: true,
    pause: true,
    file: true,
    sourceDetail: true,
    search: true,
    remove: true,
  })
  const t = useI18n()
  const menuLocation = shallowReactive({ x: 0, y: 0 })
  const isShowItemMenu = ref(false)
  const menuTask = shallowReactive({ current: null })
  const rightClickSelectedIndex = computed(() => menuTask.current ? list.value.findIndex(task => task?.id == menuTask.current.id) : -1)

  const hideMenu = () => {
    isShowItemMenu.value = false
    menuTask.current = null
  }
  watch([activeTab, () => list.value.filter(Boolean).map(task => `${task.id}:${task.status}`).join('\n')], hideMenu, { flush: 'sync' })

  const menus = computed(() => {
    return [
      {
        name: t('list__play'),
        action: 'play',
        hide: !itemMenuControl.play,
      },
      {
        name: t('list__play_next'),
        action: 'playNext',
        hide: !itemMenuControl.playNext,
      },
      {
        name: t('list__play_later'),
        action: 'playLater',
        hide: !itemMenuControl.playLater,
      },
      {
        name: t('list__add_to'),
        action: 'addTo',
        disabled: !itemMenuControl.addTo,
      },
      {
        name: t('list__start'),
        action: 'start',
        hide: !itemMenuControl.start,
      },
      {
        name: t('list__pause'),
        action: 'pause',
        hide: !itemMenuControl.pause,
      },
      {
        name: t('list__file'),
        action: 'file',
        hide: !itemMenuControl.file,
      },
      {
        name: t(!isSelectionMode.value ? 'list__multi_select' : selectedList.value.includes(menuTask.current) ? 'list__unselect_item' : 'list__select_item'),
        action: 'select',
      },
      {
        name: t('list__search'),
        action: 'search',
        hide: !itemMenuControl.search,
      },
      {
        name: t('list__source_detail'),
        action: 'sourceDetail',
        disabled: !itemMenuControl.sourceDetail,
      },
      {
        name: t('download__remove_records'),
        action: 'remove',
        hide: !itemMenuControl.remove,
      },
    ]
  })

  const showMenu = (event, taskInfo) => {
    if (!taskInfo) return
    menuTask.current = taskInfo
    itemMenuControl.sourceDetail = !!musicSdk[taskInfo.metadata.musicInfo.source]?.getMusicDetailPageUrl

    if (taskInfo.isComplate) {
      itemMenuControl.play =
        itemMenuControl.playNext =
        itemMenuControl.playLater =
        itemMenuControl.file = true
      itemMenuControl.start =
        itemMenuControl.pause = false
    } else if (taskInfo.status === DOWNLOAD_STATUS.ERROR || taskInfo.status === DOWNLOAD_STATUS.PAUSE) {
      itemMenuControl.play =
        itemMenuControl.playNext =
        itemMenuControl.playLater =
        itemMenuControl.pause =
        itemMenuControl.file = false
      itemMenuControl.start = true
    } else {
      itemMenuControl.play =
        itemMenuControl.playNext =
        itemMenuControl.playLater =
        itemMenuControl.start =
        itemMenuControl.file = false
      itemMenuControl.pause = true
    }

    if (event.pageX || event.pageY) {
      menuLocation.x = event.pageX
      menuLocation.y = event.pageY
    } else if (event.currentTarget?.getBoundingClientRect) {
      const rect = event.currentTarget.getBoundingClientRect()
      menuLocation.x = rect.right
      menuLocation.y = rect.bottom
    }

    if (isShowItemMenu.value) return

    nextTick(() => {
      if (menuTask.current === taskInfo) isShowItemMenu.value = true
    })
  }

  const menuClick = (action) => {
    const index = rightClickSelectedIndex.value
    hideMenu()
    if (!action || index < 0) return
    switch (action.action) {
      case 'select':
        selectFromMenu(index)
        break
      case 'start':
        handleStartTask(index)
        break
      case 'pause':
        handlePauseTask(index)
        break
      case 'file':
        handleOpenFile(index)
        break
      case 'play':
        handlePlayMusic(index)
        break
      case 'playNext':
        handlePlayMusicNext(index)
        break
      case 'playLater':
        handlePlayMusicLater(index)
        break
      case 'addTo':
        handleShowMusicAddModal(index)
        break
      case 'search':
        handleSearch(index)
        break
      case 'remove':
        handleRemoveTask(index)
        break
      case 'sourceDetail':
        handleOpenMusicDetail(index)
    }
  }

  return {
    rightClickSelectedIndex,
    menus,
    menuLocation,
    isShowItemMenu,
    showMenu,
    menuClick,
  }
}
