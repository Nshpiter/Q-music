import Vertical from './Vertical'
import Horizontal from './Horizontal'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useCallback } from 'react'
// import { AppColors } from '@/theme'
import commonState from '@/store/common/state'
import { setNavActiveId } from '@/core/common'
import { backToSettingOverview } from '@/store/setting/navigation'

export type { SettingScreenIds } from './Main'

export default () => {
  const { wide } = useAdaptiveLayout()
  useBackHandler(useCallback(() => {
    if (Object.keys(commonState.componentIds).length == 1 && commonState.navActiveId == 'nav_setting') {
      if (!backToSettingOverview()) setNavActiveId(commonState.lastNavActiveId == 'nav_setting' ? 'nav_love' : commonState.lastNavActiveId)
      return true
    }
    return false
  }, []))

  return wide ? <Horizontal /> : <Vertical />
}
