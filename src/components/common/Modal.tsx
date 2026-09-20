import { useImperativeHandle, forwardRef, useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Animated, Modal as NativeModal, Pressable, StyleSheet, View, type ModalProps as _ModalProps } from 'react-native'
import { useStatusbarHeight } from '@/store/common/hook'
import { useMotion } from '@/utils/useMotion'
import { Q_UI } from '@/theme/ui'
import { DockInsetContext } from './DockInset'

export interface ModalProps extends Omit<_ModalProps, 'visible'> {
  onHide?: () => void
  /**
   * 按返回键是否隐藏
   */
  keyHide?: boolean
  /**
   * 点击背景是否隐藏
   */
  bgHide?: boolean
  /**
   * 背景颜色
   */
  bgColor?: string
  /**
   * 是否填充状态栏
   */
  statusBarPadding?: boolean
}


export interface ModalType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<ModalType, ModalProps>(({
  onHide = () => {},
  keyHide = true,
  bgHide = true,
  bgColor = 'rgba(0,0,0,0)',
  statusBarPadding = true,
  children,
  onShow,
  animationType,
  ...props
}: ModalProps, ref) => {
  const [visible, setVisible] = useState(false)
  const visibleRef = useRef(false)
  const statusBarHeight = useStatusbarHeight()
  const motion = useMotion()
  const entrance = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!motion) { entrance.stopAnimation(); entrance.setValue(1) }
    return () => { entrance.stopAnimation() }
  }, [entrance, motion])

  // Keep the imperative API and the native back-drop in one state transition.
  // A ref avoids the stale `visible` value captured by the old imperative
  // handle, which was especially noticeable after quickly opening/closing a
  // menu on Android.
  const setModalVisible = useCallback((nextVisible: boolean) => {
    if (visibleRef.current == nextVisible) return
    visibleRef.current = nextVisible
    entrance.stopAnimation()
    if (nextVisible) entrance.setValue(motion && !animationType ? 0 : 1)
    setVisible(nextVisible)
    if (!nextVisible) onHide()
  }, [onHide, entrance, motion, animationType])

  const handleRequestClose = useCallback(() => {
    if (keyHide) setModalVisible(false)
  }, [keyHide, setModalVisible])

  const handleBgClose = useCallback(() => {
    if (bgHide) setModalVisible(false)
  }, [bgHide, setModalVisible])

  useImperativeHandle(ref, () => ({ setVisible: setModalVisible }), [setModalVisible])

  const memoChildren = useMemo(() => children, [children])

  return (
    <NativeModal
      animationType={motion ? animationType ?? 'fade' : 'none'}
      transparent={true}
      hardwareAccelerated={true}
      statusBarTranslucent={true}
      visible={visible}
      onRequestClose={handleRequestClose}
      {...props}
      onShow={event => {
        if (visibleRef.current && motion && !animationType) Animated.spring(entrance, { toValue: 1, ...Q_UI.motion.settle, useNativeDriver: true, overshootClamping: true }).start()
        onShow?.(event)
      }}
    >
      {/*
       * Keep the backdrop and content as siblings.  Wrapping the content in
       * TouchableWithoutFeedback made Android's responder system compete with
       * every nested Pressable; a tap on a menu row could close the modal or be
       * swallowed.  A behind-the-content Pressable gives us reliable outside
       * taps without stealing events from descendants.
       */}
      <View style={styles.root}>
        {bgHide
          ? <Pressable
              accessible={false}
              importantForAccessibility="no"
              onPress={handleBgClose}
              style={[StyleSheet.absoluteFillObject, { backgroundColor: bgColor }]}
            />
          : <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: bgColor }]} />
        }
        <Animated.View pointerEvents="box-none" style={{ flex: 1, paddingTop: statusBarPadding ? statusBarHeight : 0, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
          <DockInsetContext.Provider value={0}>{memoChildren}</DockInsetContext.Provider>
        </Animated.View>
      </View>
    </NativeModal>
  )
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
