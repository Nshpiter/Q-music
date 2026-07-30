import { forwardRef, useImperativeHandle, useRef } from 'react'
import { View, ScrollView } from 'react-native'
import Dialog, { type DialogType } from './Dialog'
import Button from './Button'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang/index'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'

const BUTTON_HIT_SLOP = { top: 4, right: 4, bottom: 4, left: 4 } as const

const styles = createStyle({
  main: {
    flexShrink: 1,
    marginTop: 16,
    marginLeft: 16,
    marginRight: 16,
    marginBottom: 20,
  },
  content: {
    flexGrow: 0,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingLeft: 15,
    paddingRight: 15,
    paddingBottom: 16,
  },
  btnsReversedDirection: {
    flexDirection: 'row-reverse',
  },
  btn: {
    flex: 1,
    minHeight: 44,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 14,
    paddingRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
})

export interface ConfirmAlertProps {
  onCancel?: () => void
  onHide?: () => void
  onConfirm?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  text?: string
  cancelText?: string
  confirmText?: string
  showConfirm?: boolean
  disabledConfirm?: boolean
  reverseBtn?: boolean
  children?: React.ReactNode | React.ReactNode[]
}

export interface ConfirmAlertType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<ConfirmAlertType, ConfirmAlertProps>(({
  onHide,
  onCancel,
  onConfirm = () => {},
  keyHide,
  bgHide,
  closeBtn,
  title = '',
  text = '',
  cancelText = '',
  confirmText = '',
  showConfirm = true,
  disabledConfirm = false,
  children,
  reverseBtn = false,
}: ConfirmAlertProps, ref) => {
  const theme = useTheme()
  const t = useI18n()

  const dialogRef = useRef<DialogType>(null)

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      dialogRef.current?.setVisible(visible)
    },
  }))

  const handleCancel = () => {
    onCancel?.()
    dialogRef.current?.setVisible(false)
  }

  return (
    <Dialog onHide={onHide} keyHide={keyHide} bgHide={bgHide} closeBtn={closeBtn} title={title} ref={dialogRef}>
      <View style={styles.main}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'}>
          {children ?? <Text color={theme['q-text-primary']}>{text}</Text>}
        </ScrollView>
      </View>
      <View style={{ ...styles.btns, ...(reverseBtn ? styles.btnsReversedDirection : null) }}>
        <Button
          style={{
            ...styles.btn,
            backgroundColor: theme['q-surface-base'],
            borderColor: theme['q-outline'],
          }}
          hitSlop={BUTTON_HIT_SLOP}
          onPress={handleCancel}
        >
          <Text color={theme['q-accent-text']}>{cancelText || t('cancel')}</Text>
        </Button>
        {showConfirm
          ? <Button
              style={{
                ...styles.btn,
                backgroundColor: theme['c-primary-dark-100'],
                borderColor: theme['c-primary-alpha-700'],
              }}
              hitSlop={BUTTON_HIT_SLOP}
              onPress={onConfirm}
              disabled={disabledConfirm}
            >
              <Text color="#fff">{confirmText || t('confirm')}</Text>
            </Button>
          : null}
      </View>
    </Dialog>
  )
})
