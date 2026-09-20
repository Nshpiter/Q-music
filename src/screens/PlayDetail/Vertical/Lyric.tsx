import { memo, useMemo, useEffect, useRef, useCallback, useState } from 'react'
import { Animated, View, FlatList, type FlatListProps, type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { type Line, useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { setSpText } from '@/utils/pixelRatio'
import { useMotion } from '@/utils/useMotion'
import { useI18n } from '@/lang'
import PlayLine, { type PlayLineType } from '../components/PlayLine'

type FlatListType = FlatListProps<Line>
interface LineProps {
  line: Line
  lineNum: number
  distance: number
  motion: boolean
  onLayout: (lineNum: number, height: number) => void
}

const LrcLine = memo(({ line, lineNum, distance, motion, onLayout }: LineProps) => {
  const theme = useTheme()
  const fontSize = useSettingValue('playDetail.vertical.style.lrcFontSize')
  const textAlign = useSettingValue('playDetail.style.align')
  const size = fontSize / 10 + 3
  const opacity = distance == 0 ? 1 : distance == 1 ? 0.52 : 0.32
  const emphasis = useRef(new Animated.Value(opacity)).current
  const scale = useRef(new Animated.Value(distance == 0 ? 1 : 0.98)).current
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(emphasis, { toValue: opacity, duration: motion ? 320 : 0, useNativeDriver: true }),
      Animated.timing(scale, { toValue: distance == 0 ? 1 : 0.98, duration: motion ? 380 : 0, useNativeDriver: true }),
    ])
    animation.start()
    return () => { animation.stop() }
  }, [distance, emphasis, motion, opacity, scale])
  return <View style={styles.line} onLayout={({ nativeEvent }) => { onLayout(lineNum, nativeEvent.layout.height) }}>
    <Animated.View style={{ opacity: emphasis, transform: [{ scale }] }}>
      <Text style={[styles.lineText, { textAlign, lineHeight: setSpText(size) * 1.4 }]} textBreakStrategy="simple" color={theme['q-text-primary']} size={size}>{line.text}</Text>
      {line.extendedLyrics.map((text, index) => <Text key={index} style={{ textAlign, marginTop: 7, lineHeight: setSpText(size * 0.72) * 1.45 }} color={theme['q-text-primary']} size={size * 0.72}>{text}</Text>)}
    </Animated.View>
  </View>
})

export default ({ active = true }: { active?: boolean }) => {
  const theme = useTheme()
  const t = useI18n()
  const musicInfo = usePlayerMusicInfo()
  const motion = useMotion()
  const lyricLines = useLrcSet()
  const { line } = useLrcPlay(active)
  const fontSize = useSettingValue('playDetail.vertical.style.lrcFontSize')
  const showProgress = useSettingValue('playDetail.isShowLyricProgressSetting')
  const [height, setHeight] = useState(0)
  const flatListRef = useRef<FlatList<Line>>(null)
  const playLineRef = useRef<PlayLineType>(null)
  const paused = useRef(false)
  const followTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)
  const currentLine = useRef(line)
  currentLine.current = line
  const layout = useRef<{ spaceHeight: number, lineHeights: number[] }>({ spaceHeight: 0, lineHeights: [] })
  const measured = useRef(new Set<number>())
  const spaceHeight = height * 0.4
  const estimatedHeight = setSpText(fontSize / 10 + 3) * 1.4 + 28

  const clearTimers = useCallback(() => {
    if (followTimer.current) clearTimeout(followTimer.current)
    if (retryTimer.current) clearTimeout(retryTimer.current)
    followTimer.current = null
    retryTimer.current = null
  }, [])

  const scrollToLine = useCallback((index = currentLine.current, animated = motion) => {
    if (!active || paused.current || index < 0 || index >= lyricLines.length || height <= 0) return
    // 逐行跟随使用实测高度；远距离跳转交给虚拟列表，有界重试补齐未测量行。
    const heights = layout.current.lineHeights
    let offset = layout.current.spaceHeight
    let complete = measured.current.has(index)
    for (let i = 0; i < index; i++) {
      if (!measured.current.has(i)) complete = false
      offset += heights[i] ?? estimatedHeight
    }
    if (complete) flatListRef.current?.scrollToOffset({ offset: Math.max(0, offset + heights[index] / 2 - height * 0.4), animated })
    else flatListRef.current?.scrollToIndex({ index, animated, viewPosition: 0.4 })
  }, [active, estimatedHeight, height, lyricLines.length, motion])

  useEffect(() => {
    clearTimers()
    paused.current = false
    measured.current.clear()
    layout.current = { spaceHeight, lineHeights: lyricLines.map(() => estimatedHeight) }
    playLineRef.current?.updateLayoutInfo(layout.current)
    playLineRef.current?.updateLyricLines(lyricLines)
    playLineRef.current?.setVisible(false)
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false })
    return clearTimers
  // 留白和字体变动由 onLayout 更新，换歌词才清空测量记录。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricLines, clearTimers])

  useEffect(() => {
    layout.current.spaceHeight = spaceHeight
    playLineRef.current?.updateLayoutInfo(layout.current)
    playLineRef.current?.updateLyricLines(lyricLines)
  }, [lyricLines, showProgress, spaceHeight])

  useEffect(() => {
    if (!active) {
      clearTimers()
      paused.current = false
      playLineRef.current?.setVisible(false)
      return
    }
    if (paused.current) return
    retryCount.current = 0
    retryTimer.current = setTimeout(() => { scrollToLine() }, 80)
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
    }
  }, [active, line, scrollToLine, clearTimers])

  const handleLineLayout = useCallback((index: number, lineHeight: number) => {
    layout.current.lineHeights[index] = lineHeight
    measured.current.add(index)
    playLineRef.current?.updateLayoutInfo({ ...layout.current })
  }, [])

  const handleScrollToIndexFailed: FlatListType['onScrollToIndexFailed'] = info => {
    if (!active || paused.current || retryCount.current >= 2) return
    retryCount.current++
    flatListRef.current?.scrollToOffset({ offset: Math.max(0, layout.current.spaceHeight + info.averageItemLength * info.index - height * 0.4), animated: false })
    if (retryTimer.current) clearTimeout(retryTimer.current)
    retryTimer.current = setTimeout(() => { scrollToLine(info.index, false) }, 120)
  }

  const handleScrollBeginDrag = () => {
    clearTimers()
    paused.current = true
    playLineRef.current?.setVisible(true)
  }
  const resumeFollow = () => {
    if (!paused.current) return
    if (followTimer.current) clearTimeout(followTimer.current)
    followTimer.current = setTimeout(() => {
      paused.current = false
      playLineRef.current?.setVisible(false)
      retryCount.current = 0
      scrollToLine()
    }, 3000)
  }
  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (paused.current) playLineRef.current?.updateScrollInfo(nativeEvent)
  }
  const handlePlayLine = (time: number) => {
    clearTimers()
    paused.current = false
    playLineRef.current?.setVisible(false)
    global.app_event.setProgress(time)
  }
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => { setHeight(nativeEvent.layout.height) }
  const spacer = useMemo(() => <View style={{ height: spaceHeight }} />, [spaceHeight])
  const renderItem: FlatListType['renderItem'] = ({ item, index }) => <LrcLine line={item} lineNum={index} distance={Math.min(2, Math.abs(index - Math.max(0, line)))} motion={motion && active} onLayout={handleLineLayout} />

  return <View style={styles.page}>
    <View style={styles.trackHeader}>
      <Image url={musicInfo.pic} style={styles.cover} />
      <View style={styles.trackText}>
        <Text size={13} style={styles.trackTitle} color={theme['q-text-primary']} numberOfLines={1}>{musicInfo.name}</Text>
        <Text size={11} color={theme['q-text-secondary']} numberOfLines={1}>{musicInfo.singer}</Text>
      </View>
    </View>
    <View style={styles.page} onLayout={onLayout}>
      {lyricLines.length ? <FlatList
        ref={flatListRef}
        data={lyricLines}
        extraData={line}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${index}:${item.text}:${item.extendedLyrics.join('|')}`}
        style={styles.container}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={spacer}
        ListFooterComponent={<View style={{ height: height * 0.6 }} />}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={resumeFollow}
        onMomentumScrollBegin={() => { if (followTimer.current) clearTimeout(followTimer.current) }}
        onMomentumScrollEnd={resumeFollow}
        fadingEdgeLength={48}
        initialNumToRender={12}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      /> : <View style={styles.empty}>
        <Icon name="lyric-on" rawSize={28} color={theme['q-text-secondary']} />
        <Text size={14} color={theme['q-text-secondary']} style={styles.emptyText}>{t('mobile_no_lyrics')}</Text>
      </View>}
      {showProgress && lyricLines.length > 0 ? <PlayLine ref={playLineRef} onPlayLine={handlePlayLine} /> : null}
    </View>
  </View>
}

const styles = createStyle({
  page: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 28 },
  trackHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingTop: 6, paddingBottom: 14 },
  cover: { width: 34, height: 34, borderRadius: 8 },
  trackText: { flex: 1, minWidth: 0, marginLeft: 10 },
  trackTitle: { fontWeight: '600', marginBottom: 3 },
  line: { paddingVertical: 14 },
  lineText: { fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.65 },
  emptyText: { marginTop: 12 },
})
