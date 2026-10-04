import { memo, useEffect, useRef } from 'react'
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useMotion } from '@/utils/useMotion'

export const useSkeletonPulse = (enabled = true) => {
  const motion = useMotion()
  const opacity = useRef(new Animated.Value(0.55)).current

  useEffect(() => {
    if (!motion || !enabled) {
      opacity.setValue(enabled ? 0.55 : 1)
      return
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]))
    animation.start()
    return () => { animation.stop() }
  }, [enabled, motion, opacity])

  return opacity
}

// 加载占位块：开启动效时柔和呼吸，关闭动效时保持静态；
// 成组使用时传 animated={false}，由外层容器统一呼吸，避免每块各跑一个循环。
export default memo(({ width = '100%', height = 12, radius = 6, animated = true, style }: {
  width?: DimensionValue
  height?: DimensionValue
  radius?: number
  animated?: boolean
  style?: StyleProp<ViewStyle>
}) => {
  const theme = useTheme()
  const opacity = useSkeletonPulse(animated)

  return <Animated.View
    accessible={false}
    importantForAccessibility="no-hide-descendants"
    style={[{ width, height, borderRadius: radius, backgroundColor: theme['q-surface-tint'], opacity }, style]}
  />
})
