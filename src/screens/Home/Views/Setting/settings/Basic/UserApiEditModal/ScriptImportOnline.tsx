import { useRef, useImperativeHandle, forwardRef, useState, useEffect, useCallback } from 'react'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Text from '@/components/common/Text'
import { View } from 'react-native'
import Input, { type InputType } from '@/components/common/Input'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { httpFetch } from '@/utils/request'
import { handleImportScript } from './action'
import { createUserApiImporter } from '@/utils/userApiImport'

interface UrlInputType {
  setText: (text: string) => void
  getText: () => string
  focus: () => void
}
const UrlInput = forwardRef<UrlInputType, {}>((props, ref) => {
  const theme = useTheme()
  const [text, setText] = useState('')
  const [placeholder, setPlaceholder] = useState('')
  const inputRef = useRef<InputType>(null)

  useImperativeHandle(ref, () => ({
    getText() {
      return text.trim()
    },
    setText(text) {
      setText(text)
      setPlaceholder(global.i18n.t('user_api_btn_import_online_input_tip'))
    },
    focus() {
      inputRef.current?.focus()
    },
  }))

  return (
    <Input
      ref={inputRef}
      placeholder={placeholder}
      value={text}
      onChangeText={setText}
      style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
    />
  )
})


export interface ScriptImportOnlineType {
  show: () => void
}


export default forwardRef<ScriptImportOnlineType, {}>((props, ref) => {
  const t = useI18n()
  const alertRef = useRef<ConfirmAlertType>(null)
  const urlInputRef = useRef<UrlInputType>(null)
  const [visible, setVisible] = useState(false)
  const [btn, setBtn] = useState({ disabled: false, text: t('user_api_btn_import_online_input_confirm') })
  const [importer] = useState(() => createUserApiImporter(url => httpFetch(url)))
  const openRef = useRef(false)
  const busyRef = useRef(false)
  const focusTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const cancelImport = useCallback(() => {
    openRef.current = false
    busyRef.current = false
    clearTimeout(focusTimerRef.current)
    importer.cancel()
  }, [importer])
  useEffect(() => cancelImport, [cancelImport])

  const handleShow = () => {
    cancelImport()
    openRef.current = true
    alertRef.current?.setVisible(true)
    setBtn({ disabled: false, text: t('user_api_btn_import_online_input_confirm') })
    requestAnimationFrame(() => {
      if (!openRef.current) return
      urlInputRef.current?.setText('')
      focusTimerRef.current = setTimeout(() => {
        urlInputRef.current?.focus()
      }, 300)
    })
  }
  useImperativeHandle(ref, () => ({
    show() {
      if (visible) handleShow()
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShow()
        })
      }
    },
  }))

  const handleImport = async() => {
    if (busyRef.current || !openRef.current) return
    busyRef.current = true
    setBtn({ disabled: true, text: t('user_api_btn_import_online_input_loading') })
    try {
      const script = await importer.load(urlInputRef.current?.getText() ?? '')
      if (script == null) return
      void handleImportScript(script)
      alertRef.current?.setVisible(false)
    } catch (err: any) {
      toast(t('user_api_import_failed_tip', { message: err.message }), 'long')
    }
    busyRef.current = false
    setBtn({ disabled: false, text: t('user_api_btn_import_online_input_confirm') })
  }

  return (
    visible
      ? <ConfirmAlert
          ref={alertRef}
          onHide={cancelImport}
          onConfirm={handleImport}
          disabledConfirm={btn.disabled}
          confirmText={btn.text}
        >
          <View style={styles.reurlContent}>
            <Text style={{ marginBottom: 5 }}>{ t('user_api_btn_import_online')}</Text>
            <UrlInput ref={urlInputRef} />
          </View>
        </ConfirmAlert>
      : null
  )
})


const styles = createStyle({
  reurlContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    borderRadius: 4,
    // paddingTop: 2,
    // paddingBottom: 2,
  },
})


