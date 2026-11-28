import { computed, watch } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import { getFontSizeWithScreen } from '@renderer/utils'
import { appSetting } from '@renderer/store/setting'
import useListSelection from '@renderer/utils/compositions/useListSelection'

export default ({ listRef, list }) => {
  const selection = useListSelection(() => list.value, listRef)
  const listItemHeight = computed(() => Math.max(50, Math.ceil((isFullscreen.value ? getFontSizeWithScreen() : appSetting['common.fontSize']) * 3.15)))
  watch(list, selection.removeAllSelect)
  return { ...selection, listItemHeight }
}
