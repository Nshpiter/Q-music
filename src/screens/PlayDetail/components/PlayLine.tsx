import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { type NativeScrollEvent, type NativeSyntheticEvent, View, Animated, Easing } from 'react-native'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { createStyle } from '@/utils/tools'
import { type Lines } from 'lrc-file-parser'
import { useTheme } from '@/store/theme/hook'
import { BorderWidths } from '@/theme'
import { qFloatingShadow, qSurfaceShadow } from '@/theme/ui'
import { formatPlayTime2 } from '@/utils'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useInteractionMotion } from '@/utils/useMotion'
import { lyricIndexAtOffset } from './lyricSeek'


export interface PlayLineType {
  updateScrollInfo: (scrollInfo: NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null) => void
  updateLayoutInfo: (listLayoutInfo: { spaceHeight: number, lineHeights: number[] }) => void
  updateLyricLines: (lyricLines: Lines) => void
  setVisible: (visible: boolean) => void
}

export interface PlayLineProps {
  onPlayLine: (time: number) => void
  onReturn: () => void
  showSeek: boolean
}

const ANIMATION_DURATION = 240

export default forwardRef<PlayLineType, PlayLineProps>(({ onPlayLine, onReturn, showSeek }, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const motion = useInteractionMotion()
  const [scrollInfo, setScrollInfo] = useState<NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null>(null)
  const [listLayoutInfo, setListLayoutInfo] = useState<{ spaceHeight: number, lineHeights: number[] }>({ spaceHeight: 0, lineHeights: [] })
  const [lyricLines, setLyricLines] = useState<Lines>([])
  const [visible, setVisible] = useState(false)
  const [interactive, setInteractive] = useState(false)
  const opsAnim = useRef<Animated.Value>(
    new Animated.Value(0),
  ).current

  useEffect(() => {
    const animation = Animated.timing(opsAnim, {
      toValue: interactive ? 1 : 0,
      duration: motion ? ANIMATION_DURATION : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    animation.start(({ finished }) => {
      if (finished && !interactive) setVisible(false)
    })
    return () => { animation.stop() }
  }, [interactive, motion, opsAnim])

  useImperativeHandle(ref, () => ({
    updateScrollInfo(scrollInfo) {
      if (showSeek) setScrollInfo(scrollInfo)
    },
    updateLayoutInfo(listLayoutInfo) {
      if (showSeek) setListLayoutInfo(listLayoutInfo)
    },
    updateLyricLines(lyricLines) {
      if (showSeek) setLyricLines(lyricLines)
    },
    setVisible(visible) {
      if (visible) setVisible(true)
      else setScrollInfo(null)
      setInteractive(visible)
    },
  }))

  if (!visible) return null
  const index = showSeek && scrollInfo ? lyricIndexAtOffset(listLayoutInfo.lineHeights, lyricLines.length,
    scrollInfo.contentOffset.y + scrollInfo.layoutMeasurement.height / 2 - listLayoutInfo.spaceHeight) : null
  const target = index == null ? null : lyricLines[index]
  const timeLabel = target ? formatPlayTime2(target.time / 1000) : ''
  return (
    <Animated.View pointerEvents={interactive ? 'box-none' : 'none'} importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'} style={[styles.overlay, { opacity: opsAnim }]}>
      {target ? <View pointerEvents="box-none" style={styles.playLine}>
        <View pointerEvents="box-none" style={styles.lineContent}>
          <View pointerEvents="none" style={[styles.timePill, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }, qSurfaceShadow]}>
            <Text style={styles.label} color={theme['q-accent-text']} size={11}>{timeLabel}</Text>
          </View>
          <View pointerEvents="none" style={{ ...styles.line, borderBottomColor: theme['c-primary-alpha-700'] }} />
          <Button
            accessibilityLabel={`${t('play')} ${timeLabel}`}
            hitSlop={{ top: 10, right: 6, bottom: 10, left: 6 }}
            pressScale={0.92}
            style={[styles.button, { backgroundColor: theme['q-surface-tint'], borderColor: theme['q-outline'] }, qSurfaceShadow]}
            onPress={() => { onPlayLine(target.time / 1000) }}
          >
            <Icon accessible={false} name="play" color={theme['q-accent-text']} rawSize={15} />
          </Button>
        </View>
      </View> : null}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.returnRow,
          {
            transform: [
              { translateY: opsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              { scale: opsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
      >
        <Button
          accessibilityRole="button"
          pressScale={0.95}
          style={[styles.returnButton, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }, qFloatingShadow]}
          onPress={onReturn}
        >
          <Icon accessible={false} name="lyric-on" rawSize={16} color={theme['q-accent-text']} />
          <Text size={12} style={styles.returnText} color={theme['q-text-primary']}>{t('play_detail_return_to_lyric')}</Text>
        </Button>
      </Animated.View>
    </Animated.View>
  )
})

const styles = createStyle({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  returnRow: { position: 'absolute', left: 12, right: 12, bottom: 10, alignItems: 'center' },
  returnButton: { minHeight: 40, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 22, borderWidth: 0.5 },
  returnText: { fontWeight: '600' },
  playLine: {
    position: 'absolute',
    width: '100%',
    top: '50%',
    left: 0,
    height: 2,
  },
  timePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 0.5,
  },
  label: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  lineContent: {
    position: 'absolute',
    width: '100%',
    height: 34,
    top: -17,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  line: {
    borderBottomWidth: BorderWidths.normal2,
    borderStyle: 'dashed',
    flex: 1,
  },
  button: {
    flex: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
