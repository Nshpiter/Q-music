import { useEffect, useMemo, useRef } from 'react'
import { Animated } from 'react-native'
import { useMotion } from '@/utils/useMotion'
import { Q_UI } from '@/theme/ui'

// 切歌时内容轻微上移淡入；首次挂载与关闭动效时直接显示。
export const useTrackChangeAnimation = (trackKey: string | number | null | undefined, offset = 6) => {
  const motion = useMotion()
  const progress = useRef(new Animated.Value(1)).current
  const lastKey = useRef(trackKey)

  useEffect(() => {
    if (lastKey.current == trackKey) return
    lastKey.current = trackKey
    progress.stopAnimation()
    if (!motion || !trackKey) {
      progress.setValue(1)
      return
    }
    progress.setValue(0)
    Animated.spring(progress, { toValue: 1, ...Q_UI.motion.settle, useNativeDriver: true }).start()
  }, [motion, progress, trackKey])

  useEffect(() => () => { progress.stopAnimation() }, [progress])

  return useMemo(() => ({
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
  }), [offset, progress])
}
