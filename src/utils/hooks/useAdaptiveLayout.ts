import { Dimensions, NativeModules, useWindowDimensions } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import { resolveAdaptiveLayout } from '../adaptiveLayout'

export default () => {
  const { width, height } = useWindowDimensions()
  const mode = useSettingValue('common.displayMode')
  const position = useSettingValue('common.largeScreenNavigation')
  const screen = Dimensions.get('screen')
  return resolveAdaptiveLayout(width, height, mode, screen.width > screen.height, NativeModules.UtilsModule?.isAutomotive === true, position)
}
