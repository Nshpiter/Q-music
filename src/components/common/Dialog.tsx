import { useImperativeHandle, forwardRef, useMemo, useRef, useEffect, useCallback } from 'react'
import { Animated, StyleSheet, View } from 'react-native'

import Modal, { type ModalType } from './Modal'
import IconButton from '@/components/common/IconButton'
import { useKeyboard } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { Q_UI } from '@/theme/ui'
import { useInteractionMotion } from '@/utils/useMotion'

const HEADER_HEIGHT = 48
const styles = createStyle({
  centeredView: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '78%',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    minHeight: HEADER_HEIGHT,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    flexShrink: 1,
    paddingLeft: 20,
    paddingRight: 60,
    paddingVertical: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 4,
    borderRadius: 12,
    flexGrow: 0,
    flexShrink: 0,
    height: HEADER_HEIGHT,
    width: HEADER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export interface DialogProps {
  onHide?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  children: React.ReactNode | React.ReactNode[]
  height?: number | `${number}%`
}

export interface DialogType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<DialogType, DialogProps>(({
  onHide,
  keyHide = true,
  bgHide = true,
  closeBtn = true,
  title = '',
  children,
  height,
}: DialogProps, ref) => {
  const theme = useTheme()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const modalRef = useRef<ModalType>(null)
  const lightEdge = theme['q-outline']
  const motion = useInteractionMotion()
  const entrance = useRef(new Animated.Value(1)).current
  const fallbackTimer = useRef<number | null>(null)
  const clearFallback = () => {
    if (fallbackTimer.current != null) {
      cancelAnimationFrame(fallbackTimer.current)
      fallbackTimer.current = null
    }
  }

  useEffect(() => {
    if (!motion) { entrance.stopAnimation(); entrance.setValue(1) }
    return () => {
      clearFallback()
      entrance.stopAnimation()
    }
  }, [entrance, motion])

  const handleShow = useCallback(() => {
    clearFallback()
    entrance.stopAnimation()
    if (!motion) { entrance.setValue(1); return }
    Animated.spring(entrance, { toValue: 1, ...Q_UI.motion.settle, overshootClamping: true, useNativeDriver: true }).start()
  }, [entrance, motion])

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      clearFallback()
      entrance.stopAnimation()
      if (visible) {
        entrance.setValue(motion ? 0 : 1)
        fallbackTimer.current = requestAnimationFrame(() => {
          fallbackTimer.current = null
          handleShow()
        })
      }
      modalRef.current?.setVisible(visible)
    },
  }))

  const closeBtnComponent = useMemo(() => {
    return closeBtn
      ? <IconButton
          name="close"
          accessibilityLabel={global.i18n.t('close')}
          iconSize={16}
          variant="plain"
          style={{ ...styles.closeBtn, width: scaleSizeH(HEADER_HEIGHT) }}
          iconColor={theme['q-text-secondary']}
          onPress={() => modalRef.current?.setVisible(false)}
        />
      : null
  }, [closeBtn, theme])

  return (
    <Modal onHide={onHide} onShow={handleShow} keyHide={keyHide} bgHide={bgHide} bgColor={theme['q-scrim']} ref={modalRef}>
      <View pointerEvents="box-none" style={{ ...styles.centeredView, paddingBottom: keyboardShown ? keyboardHeight : 0 }}>
        <Animated.View
          style={{
            ...styles.modalView,
            height,
            backgroundColor: theme['c-content-background'],
            borderColor: lightEdge,
            opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.68, 1] }),
            transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          }}
        >
          <View
            style={{
              ...styles.header,
              backgroundColor: theme['c-content-background'],
              borderBottomColor: lightEdge,
              borderBottomWidth: title ? StyleSheet.hairlineWidth : 0,
            }}
          >
            <Text style={styles.title} size={16} color={theme['q-text-primary']} numberOfLines={2}>{title}</Text>
            {closeBtnComponent}
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
})
