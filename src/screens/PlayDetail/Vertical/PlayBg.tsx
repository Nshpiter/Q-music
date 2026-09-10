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
 * 播放详情页专属氛围背景：当前封面虚化 + 高光遮罩 + 主题底色。
 * 流畅模式或无封面时不渲染，回落到全局 PageContent 的主题背景。
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

  if (!pic || performanceMode) return null

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={{ ...styles.base, backgroundColor: theme['q-playdetail-bg'] }} />
      <Animated.View style={{ ...styles.picWrap, opacity: fade }}>
        <ImageBackground
          style={{ ...styles.pic }}
          source={{ uri: pic, headers: defaultHeaders }}
          resizeMode="cover"
          blurRadius={blurRadius}
        />
      </Animated.View>
      <View style={{ ...styles.highlight, backgroundColor: theme['q-playdetail-highlight'] }} />
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
  highlight: {
    position: 'absolute',
    top: -60,
    left: '10%',
    right: '10%',
    height: '52%',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    opacity: 0.9,
  },
})
