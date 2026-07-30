
import { getAppearance, getIsSupportedAutoTheme, onAppearanceChange } from '@/utils/tools'
import { setShouldUseDarkColors, applyTheme } from '@/core/theme'
import { getTheme } from '@/theme/themes/index'
import settingState from '@/store/setting/state'
import commonState from '@/store/common/state'
import StatusBar from '@/components/common/StatusBar'
import { Navigation, type Options } from 'react-native-navigation'
import { getStatusBarStyle } from '@/navigation/utils'
// import { Dimensions, PixelRatio } from 'react-native'


const syncNavigationTheme = (theme: LX.ActiveTheme) => {
  const options: Options = {
    statusBar: {
      style: getStatusBarStyle(theme.isDark),
    },
    navigationBar: {
      backgroundColor: theme['c-content-background'],
    },
    layout: {
      componentBackgroundColor: theme['c-content-background'],
    },
  }

  for (const componentId of Object.values(commonState.componentIds)) {
    if (componentId) Navigation.mergeOptions(componentId, options)
  }
}


export default async(setting: LX.AppSetting) => {
  if (getIsSupportedAutoTheme()) {
    setShouldUseDarkColors(getAppearance() == 'dark')

    onAppearanceChange(color => {
      setShouldUseDarkColors((color ?? 'light') == 'dark')
      if (settingState.setting['common.isAutoTheme']) void getTheme().then(applyTheme)
    })
  }

  applyTheme(await getTheme())

  global.state_event.on('themeUpdated', (theme) => {
    StatusBar.setBarStyle(theme.isDark ? 'light-content' : 'dark-content')
    syncNavigationTheme(theme)
  })
  // onDimensionChange(({ window }) => {
  //   let screenW = window.width
  //   let screenH = window.height
  //   if (screenW > screenH) {
  //     const temp = screenW
  //     screenW = screenH
  //     screenH = temp
  //   }
  //   global.lx.windowInfo.screenW = screenW
  //   global.lx.windowInfo.screenH = screenH
  //   global.lx.windowInfo.screenPxW = PixelRatio.getPixelSizeForLayoutSize(screenW)
  //   global.lx.windowInfo.screenPxH = PixelRatio.getPixelSizeForLayoutSize(screenH)
  //   console.log('change', global.lx.windowInfo)
  // })
}
