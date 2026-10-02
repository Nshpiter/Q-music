import { computed, watch, ref, onBeforeUnmount } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import { getFontSizeWithScreen } from '@renderer/utils'
import { appSetting } from '@renderer/store/setting'

const useKeyEvent = ({ listRef, handleSelectAllData }) => {
  const keyEvent = {
    isShiftDown: false,
    isModDown: false,
  }

  const handle_key_shift_down = () => {
    keyEvent.isShiftDown ||= true
  }
  const handle_key_shift_up = () => {
    keyEvent.isShiftDown &&= false
  }
  const handle_key_mod_down = () => {
    keyEvent.isModDown ||= true
  }
  const handle_key_mod_up = () => {
    keyEvent.isModDown &&= false
  }
  const handle_key_mod_a_down = ({ event }) => {
    if (event.target.tagName == 'INPUT' || document.activeElement != listRef.value?.$el) return
    event.preventDefault()
    if (event.repeat) return
    keyEvent.isModDown = false
    handleSelectAllData()
  }

  onBeforeUnmount(() => {
    window.key_event.off('key_shift_down', handle_key_shift_down)
    window.key_event.off('key_shift_up', handle_key_shift_up)
    window.key_event.off('key_mod_down', handle_key_mod_down)
    window.key_event.off('key_mod_up', handle_key_mod_up)
    window.key_event.off('key_mod+a_down', handle_key_mod_a_down)
  })
  window.key_event.on('key_shift_down', handle_key_shift_down)
  window.key_event.on('key_shift_up', handle_key_shift_up)
  window.key_event.on('key_mod_down', handle_key_mod_down)
  window.key_event.on('key_mod_up', handle_key_mod_up)
  window.key_event.on('key_mod+a_down', handle_key_mod_a_down)

  return keyEvent
}

export default ({ listRef, list }) => {
  const selectedList = ref([])

  let lastSelectIndex = -1
  const listItemHeight = computed(() => {
    return Math.max(34, Math.ceil((isFullscreen.value ? getFontSizeWithScreen() : appSetting['common.fontSize']) * 2.3))
  })

  const removeAllSelect = () => {
    selectedList.value = []
    lastSelectIndex = -1
  }
  const handleSelectAllData = () => {
    removeAllSelect()
    selectedList.value = [...list.value]
    lastSelectIndex = list.value.length ? 0 : -1
  }
  const keyEvent = useKeyEvent({ handleSelectAllData, listRef })

  const handleSelectData = clickIndex => {
    if (!list.value[clickIndex]) return
    if (keyEvent.isShiftDown) {
      if (lastSelectIndex < 0 || lastSelectIndex >= list.value.length) lastSelectIndex = clickIndex
      selectedList.value = list.value.slice(Math.min(lastSelectIndex, clickIndex), Math.max(lastSelectIndex, clickIndex) + 1)
    } else if (keyEvent.isModDown) {
      lastSelectIndex = clickIndex
      let item = list.value[clickIndex]
      let index = selectedList.value.indexOf(item)
      if (index < 0) {
        selectedList.value.push(item)
      } else {
        selectedList.value.splice(index, 1)
      }
    } else {
      removeAllSelect()
      lastSelectIndex = clickIndex
    }
  }

  const toggleSelect = index => {
    const item = list.value[index]
    if (!item) return
    const selectedIndex = selectedList.value.indexOf(item)
    if (selectedIndex < 0) selectedList.value.push(item)
    else selectedList.value.splice(selectedIndex, 1)
    lastSelectIndex = index
  }

  watch(() => list.value.map(item => item.id).join('\n'), removeAllSelect)

  return {
    selectedList,
    listItemHeight,
    removeAllSelect,
    handleSelectData,
    handleSelectAllData,
    toggleSelect,
  }
}
