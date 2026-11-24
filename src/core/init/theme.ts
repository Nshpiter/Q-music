
import { getAppearance, getIsSupportedAutoTheme, onAppearanceChange } from '@/utils/tools'
import { setShouldUseDarkColors, applyTheme } from '@/core/theme'
import { getTheme } from '@/theme/themes/index'
import settingState from '@/store/setting/state'
import commonState from '@/store/common/state'
import StatusBar from '@/components/common/StatusBar'
import { Navigation, type Options } from 'react-native-navigation'
import { getStatusBarStyle } from '@/navigation/utils'
import { AppState, Keyboard } from 'react-native'
import { refreshGestureBarColor } from '@/utils/nativeModules/utils'
import { isNightTime } from '@/theme/schedule'
import { getThemeAppearance } from '@/theme/appearance'
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
  let revision = 0
  const refreshTheme = async() => {
    const current = ++revision
    const theme = await getTheme()
    if (current == revision) applyTheme(theme)
  }
  if (getIsSupportedAutoTheme()) {
    setShouldUseDarkColors(getAppearance() == 'dark')

    onAppearanceChange(color => {
      setShouldUseDarkColors((color ?? 'light') == 'dark')
      if (getThemeAppearance(settingState.setting) == 'system') void refreshTheme()
    })
  }

  await refreshTheme()
  Navigation.events().registerComponentDidAppearListener(refreshGestureBarColor)
  Navigation.events().registerComponentDidDisappearListener(refreshGestureBarColor)
  Keyboard.addListener('keyboardDidHide', refreshGestureBarColor)
  let lastTimePeriod = ''
  const refreshByTime = () => {
    if (getThemeAppearance(settingState.setting) != 'time') { lastTimePeriod = ''; return }
    const period = isNightTime(new Date(), settingState.setting) ? 'night' : 'day'
    if (period == lastTimePeriod) return
    lastTimePeriod = period
    void refreshTheme()
  }
  setInterval(refreshByTime, 60_000)
  AppState.addEventListener('change', state => {
    if (state != 'active') return
    refreshGestureBarColor()
    setShouldUseDarkColors(getAppearance() == 'dark')
    if (getThemeAppearance(settingState.setting) == 'system') void refreshTheme()
    else refreshByTime()
  })
  global.state_event.on('configUpdated', keys => {
    if (keys.some(key => ['theme.id', 'theme.lightId', 'theme.darkId', 'theme.autoByTime', 'theme.appearance', 'theme.dayStart', 'theme.nightStart', 'common.isAutoTheme', 'theme.hideBgDark'].includes(key))) {
      lastTimePeriod = ''
      void refreshTheme()
    }
  })

  global.state_event.on('themeUpdated', (theme) => {
    StatusBar.setBarStyle(theme.isDark ? 'light-content' : 'dark-content')
    syncNavigationTheme(theme)
    refreshGestureBarColor()
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
