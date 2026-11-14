import { Dimensions, NativeModules, useWindowDimensions } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import { resolveAdaptiveLayout } from '../adaptiveLayout'
import { scaleSizeH } from '../pixelRatio'

export default () => {
  const { width, height } = useWindowDimensions()
  const mode = useSettingValue('common.displayMode')
  const position = useSettingValue('common.largeScreenNavigation')
  const floating = useSettingValue('common.floatingNavigation')
  const screen = Dimensions.get('screen')
  const layout = resolveAdaptiveLayout(width, height, mode, screen.width > screen.height, NativeModules.UtilsModule?.isAutomotive === true, position, floating)
  // 与应用字号一起放大行高，虚拟列表和实际行必须使用同一个高度。
  return { ...layout, songRowHeight: Math.max(layout.songRowHeight, scaleSizeH(layout.songRowHeight)) }
}
