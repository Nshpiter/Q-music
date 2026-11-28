import { computed, watch, type Ref } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import { getFontSizeWithScreen } from '@renderer/utils'
import { appSetting } from '@renderer/store/setting'
import useListSelection from '@renderer/utils/compositions/useListSelection'

export default ({ listRef, props }: { listRef: Ref<any>, props: { list: LX.Music.MusicInfoOnline[] } }) => {
  const selection = useListSelection(() => props.list, listRef)
  const listItemHeight = computed(() => Math.max(50, Math.ceil((isFullscreen.value ? getFontSizeWithScreen() : appSetting['common.fontSize']) * 3.15)))
  watch(() => props.list, selection.removeAllSelect)
  return { ...selection, listItemHeight }
}
