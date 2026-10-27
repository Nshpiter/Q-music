import { Platform, requireNativeComponent, View, type ViewProps } from 'react-native'
import { useInteractionMotion } from '@/utils/useMotion'

const NativeBoundary = Platform.OS == 'android'
  ? requireNativeComponent<ViewProps & { enabled: boolean }>('QElasticScrollBoundary')
  : View

/** 原生触摸线程处理边缘阻尼，不通过 JS 逐帧抢占 ScrollView 的滚动。 */
export default ({ children }: { children: React.ReactNode }) => {
  const enabled = useInteractionMotion()
  return <NativeBoundary enabled={enabled} style={{ flex: 1, overflow: 'hidden' }}>{children}</NativeBoundary>
}
