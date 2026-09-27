import { memo, useEffect, useMemo, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'

import ImageBackground from '@/components/common/ImageBackground'
import { defaultHeaders } from '@/components/common/Image'
import { useIsPlay, usePlayerMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { Q_BLUR_PRESETS } from '@/theme/ui'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import { useMotion } from '@/utils/useMotion'

const BG_OPACITY = 0.88
const MIN_BLUR_RADIUS = 10

/**
 * 封面提供氛围色，整页遮罩保证歌名、歌词和操作按钮的对比度。
 * 流畅模式和无封面时使用同一底色，避免全局背景干扰阅读。
 */
export default memo(({ lyricActive }: { lyricActive: boolean }) => {
  const theme = useTheme()
  // 播放页背景无条件跟随当前歌曲封面（对齐桌面端行为，不受全局“动态背景”开关影响）
  const musicInfo = usePlayerMusicInfo()
  const pic = musicInfo.pic ?? null
  const performanceMode = useSettingValue('theme.performanceMode')
  const blurLevel = useSettingValue('theme.blurLevel')
  const isPlay = useIsPlay()
  const motion = useMotion()
  const fade = useRef(new Animated.Value(0)).current
  const detailShade = useRef(new Animated.Value(1)).current
  const drift = useRef(new Animated.Value(0)).current

  const blurRadius = useMemo(() => {
    const preset = Q_BLUR_PRESETS[blurLevel]
    return Math.max(scaleSizeAbsHR(preset.radius), MIN_BLUR_RADIUS)
  }, [blurLevel])

  useEffect(() => {
    if (!pic || performanceMode) return
    fade.setValue(0)
    Animated.timing(fade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start()
  }, [fade, pic, performanceMode])

  useEffect(() => {
    const animation = Animated.timing(detailShade, {
      toValue: lyricActive ? 0 : 1,
      duration: motion ? 420 : 0,
      useNativeDriver: true,
    })
    animation.start()
    return () => { animation.stop() }
  }, [detailShade, lyricActive, motion])

  useEffect(() => {
    if (!lyricActive || !isPlay || !motion || !pic) return
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 9000, useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 9000, useNativeDriver: true }),
    ]))
    animation.start()
    return () => { animation.stop() }
  }, [drift, isPlay, lyricActive, motion, pic])

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] })
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [22, -22] })
  const scale = drift.interpolate({ inputRange: [0, 1], outputRange: [1.18, 1.28] })
  const lyricOpacity = detailShade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={{ ...styles.base, backgroundColor: theme['q-playdetail-bg'] }} />
      {pic && !performanceMode ? <Animated.View style={{ ...styles.picWrap, opacity: fade }}>
        <Animated.View style={[styles.picMotion, { opacity: detailShade }]}>
          <ImageBackground
            style={styles.pic}
            imageStyle={styles.coverPic}
            source={{ uri: pic, headers: defaultHeaders }}
            resizeMode="cover"
            blurRadius={blurRadius}
          />
        </Animated.View>
        <Animated.View style={[styles.picMotion, { opacity: lyricOpacity, transform: [{ translateX }, { translateY }, { scale }] }]}>
          <ImageBackground
            style={styles.pic}
            source={{ uri: pic, headers: defaultHeaders }}
            resizeMode="stretch"
            blurRadius={Math.max(blurRadius, 64)}
          />
        </Animated.View>
      </Animated.View> : null}
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: theme.isDark ? 'rgba(22,26,29,0.60)' : 'rgba(251,252,247,0.68)' }} />
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: detailShade, backgroundColor: theme.isDark ? 'rgba(22,26,29,0.65)' : 'rgba(251,252,247,0.69)' }} />
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
    opacity: BG_OPACITY,
  },
  coverPic: {
    transform: [{ scale: 1.2 }],
  },
})
