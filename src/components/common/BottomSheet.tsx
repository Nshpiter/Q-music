import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Modal, { type ModalType } from './Modal'
import { useTheme } from '@/store/theme/hook'
import { useMotion } from '@/utils/useMotion'
import { Q_UI } from '@/theme/ui'

// 内容保持有界高度，FlatList 才能正确测量并滚动；退场结束后再关闭原生窗口。
export default ({ visible, onClose, onClosed, onBack = onClose, maxHeight = 680, testID = 'playlist-bottom-sheet', children }: { visible: boolean, onClose: () => void, onClosed?: () => void, onBack?: () => void, maxHeight?: number, testID?: string, children: React.ReactNode }) => {
  const modal = useRef<ModalType>(null)
  const { height } = useWindowDimensions()
  const sheetHeight = Math.min(height * 0.8, maxHeight)
  const theme = useTheme()
  const motion = useMotion()
  const offset = useRef(new Animated.Value(sheetHeight)).current
  const shown = useRef(false)
  const dragOffset = useRef(0)
  const desired = useRef(visible)
  desired.current = visible
  const afterClose = useRef(onClosed)
  afterClose.current = onClosed

  const settle = useCallback((open: boolean) => {
    offset.stopAnimation()
    const finish = () => {
      if (!open && !desired.current && shown.current) {
        shown.current = false
        modal.current?.setVisible(false)
        afterClose.current?.()
      }
    }
    if (!motion) { offset.setValue(open ? 0 : sheetHeight); finish(); return }
    Animated.spring(offset, { toValue: open ? 0 : sheetHeight, ...Q_UI.motion.settle, overshootClamping: !open, useNativeDriver: true }).start(({ finished }) => { if (finished) finish() })
  }, [motion, offset, sheetHeight])

  useEffect(() => {
    if (visible && !shown.current) {
      shown.current = true
      offset.setValue(motion ? sheetHeight : 0)
      modal.current?.setVisible(true)
    } else if (shown.current) settle(visible)
    return () => { offset.stopAnimation() }
  }, [visible, sheetHeight, motion, offset, settle])

  const drag = useMemo(() => PanResponder.create({
    // 仅拖动柄捕获起点，手指离开柄后仍连续跟随；不接管下面的列表滚动。
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => { offset.stopAnimation(value => { dragOffset.current = value }) },
    onPanResponderMove: (_, gesture) => { offset.setValue(Math.max(0, dragOffset.current + gesture.dy)) },
    onPanResponderRelease: (_, gesture) => {
      if (dragOffset.current + gesture.dy > sheetHeight * 0.2 || (gesture.dy > 16 && gesture.vy > 0.8)) onClose()
      else settle(true)
    },
    onPanResponderTerminate: () => { settle(true) },
  }), [offset, onClose, settle, sheetHeight])

  return <Modal ref={modal} animationType="none" statusBarPadding={false} keyHide={false} bgHide={false} onRequestClose={onBack} onShow={() => { settle(desired.current) }}>
    <View style={styles.root} pointerEvents={visible ? 'box-none' : 'none'}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: offset.interpolate({ inputRange: [0, sheetHeight], outputRange: [0.3, 0], extrapolate: 'clamp' }) }]} />
      <Pressable accessible={false} importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View testID={testID} accessibilityViewIsModal style={[styles.sheet, { height: sheetHeight, backgroundColor: theme['c-content-background'], transform: [{ translateY: offset }] }]}>
        <View {...drag.panHandlers} testID="bottom-sheet-handle" style={styles.gripArea} accessible={false}>
          <View style={[styles.grip, { backgroundColor: theme['q-text-secondary'] }]} />
        </View>
        {children}
      </Animated.View>
    </View>
  </Modal>
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 600, alignSelf: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', paddingBottom: 12 },
  gripArea: { height: 28, alignItems: 'center', justifyContent: 'center' },
  grip: { width: 34, height: 4, borderRadius: 2, opacity: 0.3 },
})
