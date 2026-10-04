import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import { useIsPlay } from '@/store/player/hook'
import { useMotion } from '@/utils/useMotion'

const PAUSED_COVER_SCALE = 0.9

// 暂停时封面轻微收起，播放时回弹；ready 前保持原尺寸，避免共享元素转场的落点错位。
export const useCoverPlayScale = (ready: boolean) => {
  const isPlay = useIsPlay()
  const motion = useMotion()
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!ready) return
    const target = isPlay ? 1 : PAUSED_COVER_SCALE
    scale.stopAnimation()
    if (motion) Animated.spring(scale, { toValue: target, stiffness: 180, damping: 18, mass: 0.9, useNativeDriver: true }).start()
    else scale.setValue(target)
  }, [isPlay, motion, ready, scale])
  useEffect(() => () => { scale.stopAnimation() }, [scale])

  return scale
}
