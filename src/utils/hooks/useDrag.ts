import { useCallback, useRef } from 'react'
import { type LayoutChangeEvent } from 'react-native'

export const useDrag = (onSetProgress: (progress: number) => void, onDragState: (drag: boolean) => void, setDragProgress: (progress: number) => void) => {
  const info = useRef({
    isDraging: false,
    dragStartX: 0,
    dragStartProgress: 0,
    dragProgress: 0,
    progressWidth: 0,
  })

  const onDragStart = useCallback((offsetX: number, locationX: number) => {
    if (info.current.progressWidth <= 0 || !Number.isFinite(locationX) || !Number.isFinite(offsetX)) return
    info.current.isDraging = true
    info.current.dragStartX = offsetX

    let val = locationX / info.current.progressWidth
    if (val < 0) val = 0
    if (val > 1) val = 1

    setDragProgress(info.current.dragStartProgress = info.current.dragProgress = val)
    // dragProgress.value = msEvent.msDownProgress = val
    onDragState(true)
  }, [onDragState, setDragProgress])
  const onDragEnd = useCallback(() => {
    if (info.current.isDraging) onSetProgress(info.current.dragProgress)
    info.current.isDraging = false
    onDragState(false)
  }, [onDragState, onSetProgress])
  // 系统手势或弹窗接管触摸时复位拖动，不提交取消中的播放位置。
  const onDragCancel = useCallback(() => {
    info.current.isDraging = false
    onDragState(false)
  }, [onDragState])
  const onDrag = useCallback((offsetX: number) => {
    if (!info.current.isDraging || info.current.progressWidth <= 0 || !Number.isFinite(offsetX)) return
    // dragging.value ||= true

    let progress = info.current.dragStartProgress + (offsetX - info.current.dragStartX) / info.current.progressWidth
    if (progress > 1) progress = 1
    else if (progress < 0) progress = 0
    setDragProgress(info.current.dragProgress = progress)
  }, [setDragProgress])

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    info.current.progressWidth = e.nativeEvent.layout.width
  }, [])

  // const onPress = useCallback((locationX: number) => {
  //   onSetProgress(locationX / info.current.progressWidth)
  // }, [onSetProgress])

  return {
    onLayout,
    onDragStart,
    onDragEnd,
    onDragCancel,
    onDrag,
  }
}
