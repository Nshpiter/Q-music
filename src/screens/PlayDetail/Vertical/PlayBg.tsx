import { memo, useEffect, useMemo, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'

import ImageBackground from '@/components/common/ImageBackground'
import { defaultHeaders } from '@/components/common/Image'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { Q_BLUR_PRESETS } from '@/theme/ui'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'

const BG_SCALE = 1.2
const BG_OPACITY = 0.88
const MIN_BLUR_RADIUS = 10

/**
 * 封面提供氛围色，整页遮罩保证歌名、歌词和操作按钮的对比度。
 * 流畅模式和无封面时使用同一底色，避免全局背景干扰阅读。
 */
export default memo(() => {
  const theme = useTheme()
  // 播放页背景无条件跟随当前歌曲封面（对齐桌面端行为，不受全局“动态背景”开关影响）
  const musicInfo = usePlayerMusicInfo()
  const pic = musicInfo.pic ?? null
  const performanceMode = useSettingValue('theme.performanceMode')
  const blurLevel = useSettingValue('theme.blurLevel')
  const fade = useRef(new Animated.Value(0)).current

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

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={{ ...styles.base, backgroundColor: theme['q-playdetail-bg'] }} />
      {pic && !performanceMode ? <Animated.View style={{ ...styles.picWrap, opacity: fade }}>
        <ImageBackground
          style={{ ...styles.pic }}
          source={{ uri: pic, headers: defaultHeaders }}
          resizeMode="cover"
          blurRadius={blurRadius}
        />
      </Animated.View> : null}
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: theme.isDark ? 'rgba(22,26,29,0.86)' : 'rgba(251,252,247,0.90)' }} />
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
  pic: {
    ...StyleSheet.absoluteFillObject,
    opacity: BG_OPACITY,
    transform: [{ scale: BG_SCALE }],
  },
})
