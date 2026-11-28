import { appSetting, playModeLabels, setTogglePlayMode } from '@renderer/store/setting'
import { computed } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'

export default () => {
  const t = useI18n()
  const nextTogglePlayName = computed(() => t(playModeLabels[appSetting['player.togglePlayMethod']]))

  const toggleNextPlayMode = (mode: LX.AppSetting['player.togglePlayMethod']) => {
    if (mode == appSetting['player.togglePlayMethod']) return
    setTogglePlayMode(mode)
  }

  return {
    nextTogglePlayName,
    toggleNextPlayMode,
  }
}
