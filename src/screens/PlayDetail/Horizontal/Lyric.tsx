import { memo, useMemo, useEffect, useRef, useCallback, useState } from 'react'
import { View, Pressable, PixelRatio, FlatList, type FlatListProps, type NativeSyntheticEvent, type NativeScrollEvent, type LayoutChangeEvent } from 'react-native'
// import { useLayout } from '@/utils/hooks'
import { type Line, useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
// import { useComponentIds } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import Text, { AnimatedColorText } from '@/components/common/Text'
import { setSpText } from '@/utils/pixelRatio'
import playerState from '@/store/player/state'
import { useInteractionMotion } from '@/utils/useMotion'
import PlayLine, { type PlayLineType } from '../components/PlayLine'
import { getLyricFontFamily } from '@/core/lyricFont'
import LyricCopy, { copyLyricLine } from '../components/LyricCopy'
import { isInstrumental } from '@/utils/lyricStatus'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useI18n } from '@/lang'
// import { screenkeepAwake } from '@/utils/nativeModules/utils'
// import { log } from '@/utils/log'
// import { toast } from '@/utils/tools'

type FlatListType = FlatListProps<Line>

interface LineProps {
  line: Line
  lineNum: number
  activeLine: number
  onLayout: (lineNum: number, height: number, width: number) => void
}
const LrcLine = memo(({ line, lineNum, activeLine, onLayout }: LineProps) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue('playDetail.horizontal.style.lrcFontSize')
  const textAlign = useSettingValue('playDetail.style.align')
  const fontFamily = getLyricFontFamily(useSettingValue('playDetail.style.font'))
  const size = lrcFontSize / 10
  const lineHeight = setSpText(size) * 1.3

  const colors = useMemo(() => {
    const active = activeLine == lineNum
    return active ? [
      theme['c-primary'],
      theme['c-primary-alpha-200'],
      1,
    ] as const : [
      theme['c-350'],
      theme['c-300'],
      0.6,
    ] as const
  }, [activeLine, lineNum, theme])

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    onLayout(lineNum, nativeEvent.layout.height, nativeEvent.layout.width)
  }

  // textBreakStrategy="simple" 用于解决某些设备上字体被截断的问题
  // https://stackoverflow.com/a/72822360
  return (
    <Pressable onLongPress={() => { copyLyricLine(line) }} accessibilityHint={global.i18n.t('lyric_copy_line_hint')} style={styles.line} onLayout={handleLayout}>
      <AnimatedColorText style={{
        ...styles.lineText,
        textAlign,
        fontFamily,
        lineHeight,
      }} textBreakStrategy="simple" color={colors[0]} opacity={colors[2]} size={size}>{line.text}</AnimatedColorText>
      {
        line.extendedLyrics.map((lrc, index) => {
          return (<AnimatedColorText style={{
            ...styles.lineTranslationText,
            textAlign,
            fontFamily,
            lineHeight: lineHeight * 0.8,
          }} textBreakStrategy="simple" key={index} color={colors[1]} opacity={colors[2]} size={size * 0.8}>{lrc}</AnimatedColorText>)
        })
      }
    </Pressable>
  )
}, (prevProps, nextProps) => {
  return prevProps.line === nextProps.line &&
    prevProps.activeLine != nextProps.lineNum &&
    nextProps.activeLine != nextProps.lineNum
})

export default () => {
  const [height, setHeight] = useState(0)
  const motion = useInteractionMotion()
  const edgeFade = useSettingValue('playDetail.lyricEdgeFade')
  const rawLines = useLrcSet()
  const music = usePlayerMusicInfo()
  const theme = useTheme()
  const t = useI18n()
  const instrumental = isInstrumental({ title: music.name, lyric: music.lrc })
  const lyricLines = useMemo(() => instrumental ? [] : rawLines, [instrumental, rawLines])
  const fontFamily = getLyricFontFamily(useSettingValue('playDetail.style.font'))
  const { line } = useLrcPlay()
  const flatListRef = useRef<FlatList>(null)
  const playLineRef = useRef<PlayLineType>(null)
  const isPauseScrollRef = useRef(false)
  const scrollTimoutRef = useRef<NodeJS.Timeout | null>(null)
  const delayScrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const lineRef = useRef(line)
  lineRef.current = line
  const retryCount = useRef(0)
  const listLayoutInfoRef = useRef<{ spaceHeight: number, lineHeights: number[] }>({ spaceHeight: 0, lineHeights: [] })
  const isShowLyricProgressSetting = useSettingValue('playDetail.isShowLyricProgressSetting')
  const handleScrollToActive = useCallback((index = lineRef.current, animated = motion) => {
    if (isPauseScrollRef.current || index < 0 || index >= lyricLines.length) return
    flatListRef.current?.scrollToIndex({ index, animated, viewPosition: 0.5 })
  }, [lyricLines.length, motion])

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isPauseScrollRef.current) {
      playLineRef.current?.updateScrollInfo(nativeEvent)
    }
  }
  const handleScrollBeginDrag = () => {
    isPauseScrollRef.current = true
    playLineRef.current?.setVisible(true)
    if (delayScrollTimeout.current) {
      clearTimeout(delayScrollTimeout.current)
      delayScrollTimeout.current = null
    }
    if (scrollTimoutRef.current) {
      clearTimeout(scrollTimoutRef.current)
      scrollTimoutRef.current = null
    }
  }

  const endBrowse = () => {
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
    scrollTimoutRef.current = null
    isPauseScrollRef.current = false
    retryCount.current = 0
    playLineRef.current?.setVisible(false)
  }
  const returnToCurrentLine = () => {
    endBrowse()
    handleScrollToActive(Math.max(0, lineRef.current))
  }
  const onScrollEndDrag = () => {
    if (!isPauseScrollRef.current) return
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
    scrollTimoutRef.current = setTimeout(() => {
      endBrowse()
      if (!playerState.isPlay) return
      handleScrollToActive()
    }, 3000)
  }


  useEffect(() => {
    return () => {
      if (delayScrollTimeout.current) {
        clearTimeout(delayScrollTimeout.current)
        delayScrollTimeout.current = null
      }
      if (scrollTimoutRef.current) {
        clearTimeout(scrollTimoutRef.current)
        scrollTimoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    listLayoutInfoRef.current.lineHeights = []
    isPauseScrollRef.current = false
    if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current)
    playLineRef.current?.setVisible(false)
    playLineRef.current?.updateLyricLines(lyricLines)
  }, [lyricLines, fontFamily])

  useEffect(() => {
    retryCount.current = 0
    handleScrollToActive()
    return () => {
      if (delayScrollTimeout.current) clearTimeout(delayScrollTimeout.current)
    }
  }, [line, height, lyricLines, fontFamily, handleScrollToActive])

  useEffect(() => {
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
    playLineRef.current?.updateLyricLines(lyricLines)
  }, [isShowLyricProgressSetting, lyricLines])

  const handleScrollToIndexFailed: FlatListType['onScrollToIndexFailed'] = info => {
    if (isPauseScrollRef.current || info.index !== lineRef.current || retryCount.current >= 2) return
    retryCount.current++
    flatListRef.current?.scrollToOffset({ offset: Math.max(0, info.averageItemLength * info.index), animated: false })
    if (delayScrollTimeout.current) clearTimeout(delayScrollTimeout.current)
    delayScrollTimeout.current = setTimeout(() => { handleScrollToActive(info.index, false) }, 120)
  }

  const handleLineLayout = useCallback<LineProps['onLayout']>((lineNum, height) => {
    listLayoutInfoRef.current.lineHeights[lineNum] = height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handleSpaceLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    listLayoutInfoRef.current.spaceHeight = nativeEvent.layout.height
    playLineRef.current?.updateLayoutInfo(listLayoutInfoRef.current)
  }, [])

  const handlePlayLine = (time: number) => {
    endBrowse()
    global.app_event.setProgress(time)
  }

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => {
    return (
      <LrcLine line={item} lineNum={index} activeLine={line} onLayout={handleLineLayout} />
    )
  }
  const getkey: FlatListType['keyExtractor'] = (item, index) => `${index}${item.text}`

  const spaceComponent = useMemo(() => (
    <View style={{ height: height / 2 }} onLayout={handleSpaceLayout} />
  ), [handleSpaceLayout, height])

  return (
    <>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 12 }}><LyricCopy lines={lyricLines} onSeek={handlePlayLine} /></View>
      <View style={{ flex: 1 }}>
      {lyricLines.length ? <FlatList
        key={fontFamily ?? 'default'}
        data={lyricLines}
        renderItem={renderItem}
        keyExtractor={getkey}
        style={styles.container}
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={spaceComponent}
        ListFooterComponent={spaceComponent}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollBegin={() => { if (scrollTimoutRef.current) clearTimeout(scrollTimoutRef.current) }}
        onMomentumScrollEnd={onScrollEndDrag}
        onLayout={({ nativeEvent }) => { setHeight(nativeEvent.layout.height) }}
        fadingEdgeLength={PixelRatio.getPixelSizeForLayoutSize(height * edgeFade / 100)}
        initialNumToRender={12}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        onScroll={handleScroll}
      /> : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}><Text size={14} color={theme['q-text-secondary']}>{t(instrumental ? 'mobile_instrumental' : 'mobile_no_lyrics')}</Text></View>}
      {lyricLines.length > 0 ? <PlayLine ref={playLineRef} showSeek={isShowLyricProgressSetting} onReturn={returnToCurrentLine} onPlayLine={handlePlayLine} /> : null}
      </View>
    </>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    paddingLeft: 20,
    paddingRight: 20,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  line: {
    paddingTop: 10,
    paddingBottom: 10,
    // opacity: 0,
  },
  lineText: {
    textAlign: 'center',
    // fontSize: 16,
    // lineHeight: 20,
    // paddingTop: 5,
    // paddingBottom: 5,
    // opacity: 0,
  },
  lineTranslationText: {
    textAlign: 'center',
    // fontSize: 13,
    // lineHeight: 17,
    paddingTop: 5,
    // paddingBottom: 5,
  },
})
