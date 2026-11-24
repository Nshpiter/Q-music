import { memo, useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'

import ImageBackground from '@/components/common/ImageBackground'
import { defaultHeaders } from '@/components/common/Image'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { Q_BLUR_PRESETS } from '@/theme/ui'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import useArtworkMotion from '../useArtworkMotion'
import { useMotion } from '@/utils/useMotion'
import { refreshGestureBarColor } from '@/utils/nativeModules/utils'

const MIN_BLUR_RADIUS = 48

/**
 * 封面提供氛围色，整页遮罩保证歌名、歌词和操作按钮的对比度。
 * 流畅模式和无封面时使用同一底色，避免全局背景干扰阅读。
 */
export default memo(({ lyricActive }: { lyricActive: boolean }) => {
  const theme = useTheme()
  // 播放页背景无条件跟随当前歌曲封面（对齐桌面端行为，不受全局“动态背景”开关影响）
  const musicInfo = usePlayerMusicInfo()
  const pic = musicInfo.pic?.startsWith('/') ? `file://${musicInfo.pic}` : musicInfo.pic
  const performanceMode = useSettingValue('theme.performanceMode')
  const dimming = useSettingValue('playDetail.lyricDimming')
  useEffect(refreshGestureBarColor, [lyricActive, dimming, performanceMode, theme])
  const blurLevel = useSettingValue('theme.blurLevel')
  const moving = useArtworkMotion()
  const motion = useMotion()
  const fade = useRef(new Animated.Value(0)).current
  const drift = useRef(new Animated.Value(0)).current

  const blurRadius = useMemo(() => {
    const preset = Q_BLUR_PRESETS[blurLevel]
    return Math.max(scaleSizeAbsHR(preset.radius), MIN_BLUR_RADIUS)
  }, [blurLevel])

  useEffect(() => {
    if (!pic || performanceMode) return
    fade.setValue(0)
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: motion ? 400 : 0,
      useNativeDriver: true,
    })
    animation.start()
    return () => { animation.stop() }
  }, [fade, pic, performanceMode, motion])

  useEffect(() => {
    if (!moving || !pic) return
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]))
    animation.start()
    return () => { animation.stop() }
  }, [drift, moving, pic])

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-36, 36] })
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [40, -40] })
  const scale = drift.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1.65] })
  const rotate = drift.interpolate({ inputRange: [0, 1], outputRange: ['-9deg', '9deg'] })

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={{ ...styles.base, backgroundColor: theme['q-playdetail-bg'] }} />
      {pic && !performanceMode ? <Animated.View style={{ ...styles.picWrap, opacity: fade }}>
        <Animated.View style={[styles.picMotion, { transform: [{ translateX }, { translateY }, { scale }, { rotate }] }]}>
          <ImageBackground
            style={styles.pic}
            source={{ uri: pic, headers: defaultHeaders }}
            onLoadEnd={refreshGestureBarColor}
            resizeMode="cover"
            blurRadius={blurRadius}
          />
        </Animated.View>
      </Animated.View> : null}
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,16,24,0.46)' }} />
      {lyricActive && dimming > 0 && <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: `rgba(0,0,0,${dimming / 100})` }} />}
    </View>
  )
})

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  base: {
    ...StyleSheet.absoluteFillObject,
  },
  picWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  picMotion: {
    ...StyleSheet.absoluteFillObject,
  },
  pic: {
    ...StyleSheet.absoluteFillObject,
  },
})
