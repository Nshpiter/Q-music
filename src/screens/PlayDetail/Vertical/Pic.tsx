import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { createStyle } from '@/utils/tools'
import { usePlayerMusicInfo, useIsPlay } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useNavigationComponentDidAppear } from '@/navigation'
import { HEADER_HEIGHT } from './components/Header'
import Image from '@/components/common/Image'
import { useStatusbarHeight } from '@/store/common/hook'
import commonState from '@/store/common/state'
import VinylDisc from '../components/VinylDisc'
import { useTheme } from '@/store/theme/hook'

/** 唱片一圈的旋转时长（秒），对齐桌面端 RECORD_SPIN_SECONDS */
const RECORD_SPIN_SECONDS = 18
/** shared element 过渡结束后再启动旋转，避免过渡期间内容动画穿帮 */
const SPIN_START_DELAY = 350

const startSpin = (
  rotation: Animated.Value,
  angleRef: { current: number },
  spinningRef: { current: boolean },
) => {
  const base = angleRef.current % 360
  rotation.setValue(base)
  Animated.timing(rotation, {
    toValue: base + 360,
    duration: RECORD_SPIN_SECONDS * 1000,
    easing: Easing.linear,
    useNativeDriver: true,
  }).start(({ finished }) => {
    if (finished && spinningRef.current) startSpin(rotation, angleRef, spinningRef)
  })
}

export default ({ componentId }: { componentId: string }) => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const theme = useTheme()
  const { width: winWidth, height: winHeight } = useWindowSize()
  const statusBarHeight = useStatusbarHeight()

  const [animated, setAnimated] = useState(!!commonState.componentIds.playDetail)
  const [spinReady, setSpinReady] = useState(!!commonState.componentIds.playDetail)
  const [pic, setPic] = useState(musicInfo.pic)

  const rotation = useRef(new Animated.Value(0)).current
  const angleRef = useRef(0)
  const spinningRef = useRef(false)
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
    spinTimerRef.current = setTimeout(() => { setSpinReady(true) }, SPIN_START_DELAY)
  })

  useEffect(() => () => {
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current)
    spinningRef.current = false
    rotation.stopAnimation()
  }, [rotation])

  useEffect(() => {
    if (animated) setPic(musicInfo.pic)
  }, [musicInfo.pic, animated])

  useEffect(() => {
    const listener = rotation.addListener(({ value }) => { angleRef.current = value })
    return () => { rotation.removeListener(listener) }
  }, [rotation])

  // 切歌时唱片归零重转
  useEffect(() => {
    spinningRef.current = false
    rotation.stopAnimation()
    rotation.setValue(0)
    if (spinReady && isPlay) {
      spinningRef.current = true
      startSpin(rotation, angleRef, spinningRef)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicInfo.id])

  useEffect(() => {
    if (!spinReady) return
    if (isPlay) {
      if (spinningRef.current) return
      spinningRef.current = true
      startSpin(rotation, angleRef, spinningRef)
    } else {
      spinningRef.current = false
      rotation.stopAnimation()
    }
  }, [isPlay, spinReady, rotation])

  const rotate = useMemo(
    () => rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }),
    [rotation],
  )

  const discSize = Math.min(winWidth * 0.76, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.5)
  const picSize = discSize * 0.62

  const ringStyle = (ratio: number) => ({
    width: discSize * ratio,
    height: discSize * ratio,
    borderRadius: discSize * ratio / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  })

  return (
    <View style={styles.container}>
      <View
        style={{
          ...styles.disc,
          width: discSize,
          height: discSize,
          borderRadius: discSize / 2,
          backgroundColor: theme.isDark ? '#191d20' : '#22262a',
          elevation: animated ? 3 : 0,
        }}
        nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
      >
        <Animated.View style={{ ...styles.spinLayer, transform: [{ rotate }] }}>
          <Image url={pic} style={{ width: picSize, height: picSize, borderRadius: picSize / 2 }} />
          <View style={{ ...styles.ring, ...ringStyle(0.72) }} />
          <View style={{ ...styles.ring, ...ringStyle(0.84) }} />
          <View style={{ ...styles.ring, ...ringStyle(0.96) }} />
        </Animated.View>
        <View style={{ ...styles.centerLabel, backgroundColor: theme.isDark ? '#191d20' : '#22262a' }}>
          <View style={styles.centerHole} />
        </View>
        <VinylDisc size={discSize} playing={isPlay} />
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disc: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  centerHole: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
})
