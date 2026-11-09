import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AppState } from 'react-native'

import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'

import { toast } from '@/utils/tools'

import { useI18n } from '@/lang'
import { checkDesktopLyricOverlayPermission, hideDesktopLyric, openDesktopLyricOverlayPermissionActivity, showDesktopLyric } from '@/core/desktopLyric'
import { updateSetting } from '@/core/common'

export interface DesktopLyricEnableType {
  setEnabled: (enabled: boolean) => void
}

export default forwardRef<DesktopLyricEnableType, {}>((props, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  // const setIsShowDesktopLyric = useDispatch('common', 'setIsShowDesktopLyric')
  const confirmAlertRef = useRef<ConfirmAlertType>(null)
  const pendingPermission = useRef(false)
  const enabling = useRef(false)
  const enableRef = useRef<(prompt: boolean) => Promise<void>>(async() => {})

  // 从系统授权页回来后重新核验；没有授权时不能提前保存为已开启。
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state != 'active' || !pendingPermission.current) return
      pendingPermission.current = false
      void enableRef.current(false)
    })
    return () => { subscription.remove() }
  }, [])

  useImperativeHandle(ref, () => ({
    setEnabled(enabled) {
      void handleChangeEnableDesktopLyric(enabled)
    },
  }))

  const handleShowModal = () => {
    if (visible) confirmAlertRef.current?.setVisible(true)
    else {
      setVisible(true)
      requestAnimationFrame(() => {
        confirmAlertRef.current?.setVisible(true)
      })
    }
  }
  const enableLyric = async(prompt: boolean) => {
    if (enabling.current) return
    enabling.current = true
    try {
      try { await checkDesktopLyricOverlayPermission() } catch {
        if (prompt) handleShowModal()
        return
      }
      await showDesktopLyric()
      updateSetting({ 'desktopLyric.enable': true })
    } catch { toast(t('desktop_lyric_enable_failed')) } finally { enabling.current = false }
  }
  enableRef.current = enableLyric
  const handleChangeEnableDesktopLyric = async(isEnable: boolean) => {
    pendingPermission.current = false
    if (isEnable) await enableLyric(true)
    else {
      await hideDesktopLyric()
      updateSetting({ 'desktopLyric.enable': false })
    }
  }

  const handleTipsCancel = () => {
    updateSetting({ 'desktopLyric.enable': false })
    toast(t('disagree_tip'), 'long')
  }
  const handleTipsConfirm = () => {
    confirmAlertRef.current?.setVisible(false)
    pendingPermission.current = true
    void openDesktopLyricOverlayPermissionActivity().catch(() => { pendingPermission.current = false; toast(t('desktop_lyric_enable_failed')) })
  }

  return (
    visible
      ? (
          <ConfirmAlert
            ref={confirmAlertRef}
            onCancel={handleTipsCancel}
            onConfirm={handleTipsConfirm}
            bgHide={false}
            closeBtn={false}
            cancelText={t('disagree')}
            confirmText={t('agree_go')}
            text={t('setting_lyric_desktop_permission_tip')} />
        )
      : null
  )
})
