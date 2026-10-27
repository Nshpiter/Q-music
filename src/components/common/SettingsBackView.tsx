import { Animated, Platform, requireNativeComponent, View, type ViewProps, type NativeSyntheticEvent } from 'react-native'

interface Props extends ViewProps {
  backEnabled: boolean
  onBackProgress?: (event: NativeSyntheticEvent<{ progress: number }>) => void
}
const NativeView = Platform.OS == 'android' ? requireNativeComponent<Props>('QSettingsBackView') : View
export default Animated.createAnimatedComponent(NativeView)
