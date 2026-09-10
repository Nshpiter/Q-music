import { memo, useEffect, useMemo, useRef } from 'react'
import { Animated, View } from 'react-native'
import { createStyle } from '@/utils/tools'

interface Props {
  /** 唱片直径（用于按比例绘制唱针各部件） */
  size: number
  playing: boolean
}

/**
 * 播放页唱片机的唱针：支点固定在唱片右上角，
 * 播放时落针（0°），暂停时抬针（-32°）。
 */
export default memo(({ size, playing }: Props) => {
  const needle = useRef(new Animated.Value(-32)).current
  const pivot = size * 0.12
  const rodLength = size * 0.34

  useEffect(() => {
    Animated.spring(needle, {
      toValue: playing ? 0 : -32,
      friction: 6,
      bounciness: 5,
      useNativeDriver: true,
    }).start()
  }, [needle, playing])

  const rotate = useMemo(
    () => needle.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }),
    [needle],
  )

  const armStyle = useMemo(() => ({
    ...styles.arm,
    top: pivot * 0.72,
    left: pivot / 2 - size * 0.008,
    width: Math.max(size * 0.016, 2),
    height: rodLength,
  }), [pivot, rodLength, size])

  const headStyle = useMemo(() => ({
    ...styles.head,
    top: pivot * 0.72 + rodLength - size * 0.012,
    left: pivot / 2 - size * 0.024,
    width: size * 0.048,
    height: size * 0.072,
    borderRadius: size * 0.012,
  }), [pivot, rodLength, size])

  return (
    <View style={{ ...styles.container, top: size * 0.03, right: size * 0.10, width: pivot, height: pivot }} pointerEvents="none">
      <Animated.View style={{ width: pivot, height: pivot, transform: [{ rotate }] }}>
        <View style={{ ...styles.pivot, width: pivot, height: pivot, borderRadius: pivot / 2 }}>
          <View style={{ ...styles.pivotInner, borderRadius: pivot / 4 }} />
        </View>
        <View style={{ ...armStyle, borderRadius: Math.max(size * 0.008, 1) }} />
        <View style={headStyle} />
      </Animated.View>
    </View>
  )
})

const styles = createStyle({
  container: {
    position: 'absolute',
    zIndex: 2,
  },
  pivot: {
    backgroundColor: '#e3e5e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pivotInner: {
    width: '50%',
    height: '50%',
    backgroundColor: '#b7babf',
  },
  arm: {
    position: 'absolute',
    backgroundColor: '#d3d6da',
  },
  head: {
    position: 'absolute',
    backgroundColor: '#c2c5c9',
  },
})
