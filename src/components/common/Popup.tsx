import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Modal, { type ModalType } from './Modal'
import { Icon } from '@/components/common/Icon'
import { useKeyboard } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'
import { useStatusbarHeight } from '@/store/common/hook'

const CONTROL_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const

const styles = createStyle({
  centeredView: {
    flex: 1,
  },
  modalView: {
    borderWidth: 1,
    elevation: 8,
    flexGrow: 0,
    flexShrink: 1,
    overflow: 'hidden',
  },
  header: {
    flex: 0,
    flexDirection: 'row',
    minHeight: 44,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  title: {
    flexShrink: 1,
    paddingLeft: 16,
    paddingRight: 56,
    paddingTop: 12,
    paddingBottom: 12,
    fontWeight: '600',
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 4,
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
    width: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export interface PopupProps {
  onHide?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  position?: 'top' | 'left' | 'right' | 'bottom'
  title?: string
  children: React.ReactNode
}

export interface PopupType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<PopupType, PopupProps>(({
  onHide = () => {},
  keyHide = true,
  bgHide = true,
  closeBtn = true,
  position = 'bottom',
  title = '',
  children,
}: PopupProps, ref) => {
  const theme = useTheme()
  const { keyboardShown, keyboardHeight } = useKeyboard()
  const statusBarHeight = useStatusbarHeight()

  const modalRef = useRef<ModalType>(null)

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      modalRef.current?.setVisible(visible)
    },
  }))

  const closeBtnComponent = useMemo(() => closeBtn
    ? <TouchableOpacity
        style={styles.closeBtn}
        hitSlop={CONTROL_HIT_SLOP}
        onPress={() => modalRef.current?.setVisible(false)}
      >
        <Icon name="close" style={{ color: theme['q-text-secondary'] }} size={16} />
      </TouchableOpacity>
    : null, [closeBtn, theme])

  const [centeredViewStyle, modalViewStyle] = useMemo(() => {
    switch (position) {
      case 'top':
        return [
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            justifyContent: 'flex-start',
          },
          {
            width: '100%',
            maxHeight: '78%',
            minHeight: '20%',
            borderBottomLeftRadius: 22,
            borderBottomRightRadius: 22,
          },
        ] as const
      case 'left':
        return [
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            flexDirection: 'row',
            justifyContent: 'flex-start',
          },
          {
            minWidth: '45%',
            maxWidth: '78%',
            height: '100%',
            paddingTop: statusBarHeight,
            borderTopRightRadius: 22,
            borderBottomRightRadius: 22,
          },
        ] as const
      case 'right':
        return [
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            flexDirection: 'row',
            justifyContent: 'flex-end',
          },
          {
            minWidth: '45%',
            maxWidth: '78%',
            height: '100%',
            paddingTop: statusBarHeight,
            borderTopLeftRadius: 22,
            borderBottomLeftRadius: 22,
          },
        ] as const
      case 'bottom':
      default:
        return [
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 0,
            justifyContent: 'flex-end',
          },
          {
            width: '100%',
            maxHeight: '78%',
            minHeight: '20%',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
          },
        ] as const
    }
  }, [position, statusBarHeight])

  return (
    <Modal onHide={onHide} keyHide={keyHide} bgHide={bgHide} bgColor={theme['q-scrim']} ref={modalRef}>
      <View style={{ ...styles.centeredView, ...centeredViewStyle, paddingBottom: keyboardShown ? keyboardHeight : 0 }}>
        <View
          style={{
            ...styles.modalView,
            ...modalViewStyle,
            backgroundColor: theme['q-surface-raised'],
            borderColor: theme['q-outline'],
          }}
          onStartShouldSetResponder={() => true}
        >
          <View
            style={{
              ...styles.header,
              backgroundColor: theme['q-surface-tint'],
              borderBottomColor: theme['q-outline'],
            }}
          >
            <Text size={15} color={theme['q-text-primary']} style={styles.title} numberOfLines={1}>{title}</Text>
            {closeBtnComponent}
          </View>
          {children}
        </View>
      </View>
    </Modal>
  )
})
