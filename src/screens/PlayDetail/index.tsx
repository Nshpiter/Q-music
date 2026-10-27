import { useEffect, useMemo } from 'react'
import { Navigation } from 'react-native-navigation'

import Vertical from './Vertical'
import Wide from './Wide'
import Immersive from './Immersive'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import { ThemeContext } from '@/store/theme/state'
import { useSettingValue } from '@/store/setting/hook'
import { getPlayerTheme } from '@/theme/playerAppearance'
import { getStatusBarStyle } from '@/navigation/utils'
import { SongActionsProvider } from './components/SongActions'

export default ({ componentId }: { componentId: string }) => {
  const { wide } = useAdaptiveLayout()
  const baseTheme = useTheme()
  const layout = useSettingValue('playDetail.style.layout')
  const theme = useMemo(() => getPlayerTheme(baseTheme, layout), [baseTheme, layout])
  useEffect(() => {
    const background = layout == 'immersive' ? theme['q-playdetail-bg'] : theme['c-content-background']
    Navigation.mergeOptions(componentId, {
      statusBar: { style: getStatusBarStyle(theme.isDark) },
      navigationBar: { backgroundColor: background },
      layout: { componentBackgroundColor: background },
    })
  }, [componentId, theme, layout])
  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ThemeContext.Provider value={theme}>
      <SongActionsProvider><PageContent>
        <StatusBar />
        {layout == 'immersive' ? <Immersive componentId={componentId} /> : wide ? <Wide componentId={componentId} /> : <Vertical componentId={componentId} />}
      </PageContent></SongActionsProvider>
    </ThemeContext.Provider>
  )
}
