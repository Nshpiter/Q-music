import { useImperativeHandle, forwardRef, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'

import Modal, { type ModalType } from './Modal'
import IconButton from '@/components/common/IconButton'
import { useKeyboard } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { qFloatingShadow } from '@/theme/ui'

const HEADER_HEIGHT = 48
const styles = createStyle({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '90%',
    maxWidth: 380,
    maxHeight: '78%',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    height: HEADER_HEIGHT,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    flexShrink: 1,
    paddingLeft: 16,
    paddingRight: 56,
    lineHeight: HEADER_HEIGHT,
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
  const lightEdge = theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.76)'
  const scrim = theme.isDark ? 'rgba(6,12,10,0.48)' : 'rgba(238,248,243,0.56)'

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
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
    <Modal onHide={onHide} keyHide={keyHide} bgHide={bgHide} bgColor={scrim} ref={modalRef}>
      <View pointerEvents="box-none" style={{ ...styles.centeredView, paddingBottom: keyboardShown ? keyboardHeight : 0 }}>
        <View
          style={{
            ...styles.modalView,
            ...qFloatingShadow,
            height,
            backgroundColor: theme['q-surface-raised'],
            borderColor: lightEdge,
          }}
        >
          <View
            style={{
              ...styles.header,
              backgroundColor: theme.isDark ? theme['q-surface-tint'] : 'rgba(255,255,255,0.42)',
              borderBottomColor: lightEdge,
            }}
          >
            <Text style={styles.title} size={15} color={theme['q-text-primary']} numberOfLines={1}>{title}</Text>
            {closeBtnComponent}
          </View>
          {children}
        </View>
      </View>
    </Modal>
  )
})
