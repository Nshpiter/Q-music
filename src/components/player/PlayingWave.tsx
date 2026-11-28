import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native'
import { useMotion } from '@/utils/useMotion'
import { useIsPlay } from '@/store/player/hook'

interface PlayingWaveProps {
  playing?: boolean
  color: string
  size?: number
  style?: StyleProp<ViewStyle>
}

const BARS = [
  { rest: 0.38, min: 0.28, max: 0.96, up: 290, down: 340, delay: 0 },
  { rest: 0.68, min: 0.34, max: 1.0, up: 240, down: 310, delay: 110 },
  { rest: 0.46, min: 0.25, max: 0.88, up: 320, down: 280, delay: 200 },
] as const

const PlayingWave = memo(({ playing = true, color, size = 14, style }: PlayingWaveProps) => {
  const motion = useMotion()
  const scales = useRef(BARS.map(bar => new Animated.Value(bar.rest))).current

  useEffect(() => {
    if (!playing || !motion) {
      const settle = Animated.parallel(
        scales.map((value, index) => Animated.timing(value, {
          toValue: BARS[index].rest,
          duration: motion ? 180 : 0,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })),
      )
      settle.start()
      return () => { settle.stop() }
    }

    const loops = scales.map((value, index) => {
      const bar = BARS[index]
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: bar.max,
            duration: bar.up,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: bar.min,
            duration: bar.down,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      )
      const timer = bar.delay > 0 ? setTimeout(() => { loop.start() }, bar.delay) : null
      if (!timer) loop.start()
      return () => {
        if (timer) clearTimeout(timer)
        loop.stop()
      }
    })

    return () => {
      for (const stop of loops) stop()
    }
  }, [motion, playing, scales])

  const barWidth = Math.max(2, Math.round(size * 0.19))
  const gap = Math.max(2, Math.round(size * 0.14))

  return (
    <View
      accessible={false}
      style={[
        {
          height: size,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap,
        },
        style,
      ]}
    >
      {scales.map((scaleY, index) => (
        <Animated.View
          key={index}
          style={{
            width: barWidth,
            height: size,
            borderRadius: barWidth / 2,
            backgroundColor: color,
            transform: [
              { translateY: size / 2 },
              { scaleY },
              { translateY: -size / 2 },
            ],
          }}
        />
      ))}
    </View>
  )
})

export const ActivePlayingWave = memo(({ color, size = 14, style }: Omit<PlayingWaveProps, 'playing'>) => {
  const isPlay = useIsPlay()
  return <PlayingWave playing={isPlay} color={color} size={size} style={style} />
})

export default PlayingWave
