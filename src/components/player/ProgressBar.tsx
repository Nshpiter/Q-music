import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, PanResponder, type LayoutChangeEvent } from 'react-native'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeW, scaleSizeH } from '@/utils/pixelRatio'
import { useDrag } from '@/utils/hooks'
import { formatPlayTime2 } from '@/utils'
import { qFloatingShadow } from '@/theme/ui'
import Text from '@/components/common/Text'


const DefaultBar = memo(({ expanded }: { expanded: boolean }) => {
  const theme = useTheme()

  return <View style={{ ...styles.progressBar, height: expanded ? progressDragHeight : progressHeight, backgroundColor: theme['q-outline'], position: 'absolute', width: '100%', left: 0, top: expanded ? -(progressDragHeight - progressHeight) / 2 : 0 }} />
})

const BufferedBar = memo(({ progress, expanded }: { progress: number, expanded: boolean }) => {
  const theme = useTheme()
  return <View style={{ ...styles.progressBar, height: expanded ? progressDragHeight : progressHeight, backgroundColor: theme['q-surface-tint'], position: 'absolute', width: `${progress * 100}%`, left: 0, top: expanded ? -(progressDragHeight - progressHeight) / 2 : 0 }} />
})


const PreassBar = memo(({ onDragState, setDragProgress, onSetProgress }: {
  onDragState: (drag: boolean) => void
  setDragProgress: (progress: number) => void
  onSetProgress: (progress: number) => void
}) => {
  const {
    onLayout,
    onDragStart,
    onDragEnd,
    onDragCancel,
    onDrag,
  } = useDrag(onSetProgress, onDragState, setDragProgress)
  // const handlePress = useCallback((event: GestureResponderEvent) => {
  //   onPress(event.nativeEvent.locationX)
  // }, [onPress])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt, gestureState) => true,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,

      // onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        onDrag(gestureState.dx)
      },
      onPanResponderGrant: (evt, gestureState) => {
        // console.log(evt.nativeEvent.locationX, gestureState)
        onDragStart(gestureState.dx, evt.nativeEvent.locationX)
      },
      onPanResponderRelease: () => {
        onDragEnd()
      },
      onPanResponderTerminate: onDragCancel,
    }),
  ).current

  return <View onLayout={onLayout} style={styles.pressBar} {...panResponder.panHandlers} />
})


const Progress = ({ progress, duration, buffered }: {
  progress: number
  duration: number
  buffered: number
}) => {
  // const { progress: bufferProgress } = usePlayTimeBuffer()
  const theme = useTheme()
  const [draging, setDraging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)
  const [trackWidth, setTrackWidth] = useState(0)
  const progressStr: `${number}%` = `${duration > 0 && Number.isFinite(progress) ? Math.max(0, Math.min(progress, 1)) * 100 : 0}%`
  const clampedDrag = Math.max(0, Math.min(1, dragProgress))
  const activeHeight = draging ? progressDragHeight : progressHeight
  const activeTop = draging ? -(progressDragHeight - progressHeight) / 2 : 0

  const progressDotStyle = useMemo(() => {
    const size = draging ? progressDotSize * 1.65 : progressDotSize
    const barH = draging ? scaleSizeH(progressDragHeight) : progressHeightSize
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: theme['q-text-primary'],
      borderWidth: draging ? 2 : 0,
      borderColor: theme['q-accent'],
      position: 'absolute',
      right: -size / 2,
      top: -(size - barH) / 2,
    } as const
  }, [draging, theme])

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width)
  }, [])

  const previewLeft = trackWidth > 0
    ? Math.max(0, Math.min(trackWidth - PREVIEW_PILL_WIDTH, clampedDrag * trackWidth - PREVIEW_PILL_WIDTH / 2))
    : 0

  const durationRef = useRef(duration)
  useEffect(() => {
    durationRef.current = duration
  }, [duration])
  const onSetProgress = useCallback((progress: number) => {
    if (durationRef.current > 0) global.app_event.setProgress(progress * durationRef.current)
  }, [])

  return (
    <View style={styles.progress} onLayout={handleTrackLayout}>
      {draging && duration > 0 && trackWidth > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.seekPreview,
            qFloatingShadow,
            {
              left: previewLeft,
              backgroundColor: theme['q-surface-raised'],
              borderColor: theme['q-outline'],
            },
          ]}
        >
          <Text size={11} style={styles.seekPreviewText} color={theme['q-accent-text']}>
            {formatPlayTime2(clampedDrag * duration)}
          </Text>
        </View>
      ) : null}
      <View>
        <DefaultBar expanded={draging} />
        <BufferedBar expanded={draging} progress={duration > 0 && Number.isFinite(buffered) ? Math.max(0, Math.min(buffered, 1)) : 0} />
        {
          draging
            ? (
                <>
                  <View style={{ ...styles.progressBar, height: activeHeight, backgroundColor: theme['q-accent'], opacity: 0.35, width: progressStr, position: 'absolute', left: 0, top: activeTop }} />
                  <View style={{ ...styles.progressBar, height: activeHeight, backgroundColor: theme['q-accent'], width: `${clampedDrag * 100}%`, position: 'absolute', left: 0, top: activeTop }}>
                    <View style={progressDotStyle} />
                  </View>
                </>
              ) : (
                <View style={{ ...styles.progressBar, backgroundColor: theme['q-accent'], width: progressStr, position: 'absolute', left: 0, top: 0 }}>
                  <View style={progressDotStyle} />
                </View>
              )
        }

      </View>
      <PreassBar onDragState={setDraging} setDragProgress={setDragProgress} onSetProgress={onSetProgress} />
    </View>
  )
}


const progressContentPadding = 10
const progressHeight = 3.6
const progressDragHeight = 5.6
const PREVIEW_PILL_WIDTH = 56
const progressContentHeight = progressContentPadding * 2 + progressHeight
const progressHeightSize = scaleSizeH(progressHeight)
const progressDotSize = scaleSizeW(8)
const styles = createStyle({
  progress: {
    width: '100%',
    height: progressContentHeight,
    paddingTop: progressContentPadding,
    paddingBottom: progressContentPadding,
    zIndex: 1,
    overflow: 'visible',
  },
  seekPreview: {
    position: 'absolute',
    bottom: progressContentHeight + 2,
    width: PREVIEW_PILL_WIDTH,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  seekPreviewText: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressBar: {
    height: progressHeight,
    borderRadius: 4,
  },
  pressBar: {
    position: 'absolute',
    // backgroundColor: 'rgba(0,0,0,0.5)',
    left: 0,
    top: 0,
    height: progressContentHeight,
    paddingTop: progressContentPadding,
    paddingBottom: progressContentPadding,
    width: '100%',
    zIndex: 6,
  },
})

export default Progress
