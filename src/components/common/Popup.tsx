import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { View } from 'react-native'

import Modal, { type ModalType } from './Modal'
import IconButton from '@/components/common/IconButton'
import { useKeyboard } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'

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
    minHeight: 48,
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
    height: 48,
    width: 48,
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

  const modalRef = useRef<ModalType>(null)

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      modalRef.current?.setVisible(visible)
    },
  }))

  const closeBtnComponent = useMemo(() => closeBtn
    ? <IconButton
        accessibilityLabel={global.i18n.t('close')}
        name="close"
        iconSize={16}
        variant="plain"
        style={styles.closeBtn}
        onPress={() => modalRef.current?.setVisible(false)}
        iconColor={theme['q-text-secondary']}
      />
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
  }, [position])

  return (
    <Modal onHide={onHide} keyHide={keyHide} bgHide={bgHide} bgColor={theme['q-scrim']} ref={modalRef}>
      <View pointerEvents="box-none" style={{ ...styles.centeredView, ...centeredViewStyle, paddingBottom: keyboardShown ? keyboardHeight : 0 }}>
        <View
          style={{
            ...styles.modalView,
            ...modalViewStyle,
            backgroundColor: theme['q-surface-raised'],
            borderColor: theme['q-outline'],
          }}
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
