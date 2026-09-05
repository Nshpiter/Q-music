import { memo, useMemo } from 'react'
import { toast } from '@/utils/tools'
import { MUSIC_TOGGLE_MODE_LIST, MUSIC_TOGGLE_MODE } from '@/config/constant'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import Btn from './Btn'

type PlayModeMessage = 'play_list_loop' | 'play_list_random' | 'play_list_order' | 'play_single_loop' | 'play_single'

const getPlayModeMessage = (mode: typeof MUSIC_TOGGLE_MODE_LIST[number]): PlayModeMessage => {
  switch (mode) {
    case MUSIC_TOGGLE_MODE.listLoop:
      return 'play_list_loop'
    case MUSIC_TOGGLE_MODE.random:
      return 'play_list_random'
    case MUSIC_TOGGLE_MODE.list:
      return 'play_list_order'
    case MUSIC_TOGGLE_MODE.singleLoop:
      return 'play_single_loop'
    default:
      return 'play_single'
  }
}


export default memo(() => {
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')
  const t = useI18n()

  const toggleNextPlayMode = () => {
    let index = MUSIC_TOGGLE_MODE_LIST.indexOf(togglePlayMethod)
    if (++index >= MUSIC_TOGGLE_MODE_LIST.length) index = 0
    const mode = MUSIC_TOGGLE_MODE_LIST[index]
    updateSetting({ 'player.togglePlayMethod': mode })
    toast(t(getPlayModeMessage(mode)))
  }

  const playModeIcon = useMemo(() => {
    let playModeIcon = null
    switch (togglePlayMethod) {
      case MUSIC_TOGGLE_MODE.listLoop:
        playModeIcon = 'list-loop'
        break
      case MUSIC_TOGGLE_MODE.random:
        playModeIcon = 'list-random'
        break
      case MUSIC_TOGGLE_MODE.list:
        playModeIcon = 'list-order'
        break
      case MUSIC_TOGGLE_MODE.singleLoop:
        playModeIcon = 'single-loop'
        break
      default:
        playModeIcon = 'single'
        break
    }
    return playModeIcon
  }, [togglePlayMethod])

  return <Btn icon={playModeIcon} accessibilityLabel={t(getPlayModeMessage(togglePlayMethod))} onPress={toggleNextPlayMode} />
})
