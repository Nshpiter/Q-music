import { computed, ref, shallowReactive, reactive, nextTick } from '@common/utils/vueTools'
import musicSdk from '@renderer/utils/musicSdk'
import { useI18n } from '@renderer/plugins/i18n'
import { hasDislike } from '@renderer/core/dislikeList'
import { buildSongMenus } from '@renderer/utils/songMenu'

export default ({
  isSelectionMode,
  selectedList,
  selectFromMenu,
  assertApiSupport,
  emit,

  handleShowDownloadModal,
  handlePlayMusic,
  handlePlayMusicNext,
  handlePlayMusicLater,
  handleSearch,
  handleShowMusicToggleModal,
  handleShowMusicAddModal,
  handleShowMusicMoveModal,
  handleShowSortModal,
  handleOpenMusicDetail,
  handleCopyName,
  handleDislikeMusic,
  handleRemoveMusic,
}) => {
  const itemMenuControl = reactive({
    play: true,
    playNext: true,
    playLater: true,
    copyName: true,
    addTo: true,
    moveTo: true,
    sort: true,
    toggleSource: true,
    download: true,
    search: true,
    dislike: true,
    remove: true,
    sourceDetail: true,
  })
  const menuMusic = ref(null)
  const t = useI18n()
  const menuLocation = shallowReactive({ x: 0, y: 0 })
  const isShowItemMenu = ref(false)

  const menus = computed(() => {
    return buildSongMenus({
      t,
      isSelectionMode: isSelectionMode.value,
      isSelected: selectedList.value.includes(menuMusic.value),
      control: itemMenuControl,
      includeMoveTo: true,
      includeSort: true,
      includeToggleSource: true,
      includeCopyName: true,
      includeRemove: true,
    })
  })

  const showMenu = (event, musicInfo) => {
    if (!musicInfo) return
    menuMusic.value = musicInfo
    itemMenuControl.sourceDetail = !!musicSdk[musicInfo.source]?.getMusicDetailPageUrl
    itemMenuControl.download = assertApiSupport(musicInfo.source) && musicInfo.source != 'local'
    itemMenuControl.dislike = !hasDislike(musicInfo)

    if (event.pageX || event.pageY) {
      menuLocation.x = event.pageX
      menuLocation.y = event.pageY
    } else if (event.currentTarget?.getBoundingClientRect) {
      const rect = event.currentTarget.getBoundingClientRect()
      menuLocation.x = rect.right
      menuLocation.y = rect.bottom
    }

    if (isShowItemMenu.value) return

    emit('show-menu')
    nextTick(() => {
      isShowItemMenu.value = true
    })
  }

  const hideMenu = () => {
    isShowItemMenu.value = false
  }

  const menuClick = (action, index) => {
    hideMenu()
    if (!action) return
    switch (action.action) {
      case 'select':
        selectFromMenu(index)
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
      case 'copyName':
        handleCopyName(index)
        break
      case 'addTo':
        handleShowMusicAddModal(index)
        break
      case 'moveTo':
        handleShowMusicMoveModal(index)
        break
      case 'sort':
        handleShowSortModal(index)
        break
      case 'toggleSource':
        handleShowMusicToggleModal(index)
        break
      case 'download':
        handleShowDownloadModal(index)
        break
      case 'search':
        handleSearch(index)
        break
      case 'dislike':
        handleDislikeMusic(index)
        break
      case 'remove':
        handleRemoveMusic(index)
        break
      case 'sourceDetail':
        handleOpenMusicDetail(index)
    }
  }

  return {
    menus,
    menuLocation,
    isShowItemMenu,
    showMenu,
    menuClick,
  }
}
