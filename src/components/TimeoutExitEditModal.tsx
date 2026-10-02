import { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Text from '@/components/common/Text'
import { TouchableOpacity, View } from 'react-native'
import Input, { type InputType } from '@/components/common/Input'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { cancelTimeoutExit, getTimeoutExitTime, onTimeUpdate, startTimeoutExit, stopTimeoutExit, useTimeoutExitTimeInfo } from '@/core/player/timeoutExit'
import { useI18n } from '@/lang'
import CheckBox from './common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'

const MAX_MIN = 1440
const rxp = /^[1-9]\d*$/
const formatTime = (time: number) => {
  // let d = parseInt(time / 86400)
  // d = d ? d.toString() + ':' : ''
  // time = time % 86400
  let h = Math.trunc(time / 3600)
  let hStr = h ? h.toString() + ':' : ''
  time = time % 3600
  const m = Math.trunc(time / 60).toString().padStart(2, '0')
  const s = Math.trunc(time % 60).toString().padStart(2, '0')
  return `${hStr}${m}:${s}`
}
const Status = () => {
  const theme = useTheme()
  const t = useI18n()
  const exitTimeInfo = useTimeoutExitTimeInfo()
  return (
    <View style={styles.tip}>
      {
      exitTimeInfo.time < 0
        ? (
            !exitTimeInfo.isPlayedStop ? <Text>{t('timeout_exit_tip_off')}</Text> : null
          )
        : (
            <Text>{t('timeout_exit_tip_on', { time: formatTime(exitTimeInfo.time) })}</Text>
          )
      }
      {exitTimeInfo.isPlayedStop ? <Text color={theme['c-font-label']} size={13}>{t('timeout_exit_btn_wait_tip')}</Text> : null}
    </View>
  )
}


const Setting = () => {
  const t = useI18n()
  const timeoutExitPlayed = useSettingValue('player.timeoutExitPlayed')
  const onCheckChange = (check: boolean) => {
    updateSetting({ 'player.timeoutExitPlayed': check })
  }

  return (
    <View style={styles.checkbox}>
      <CheckBox check={timeoutExitPlayed} label={t('timeout_exit_label_isPlayed')} onChange={onCheckChange} />
    </View>
  )
}

export const useTimeInfo = () => {
  const [exitTimeInfo, setExitTimeInfo] = useState({
    cancelText: '',
    confirmText: '',
    isPlayedStop: false,
    active: false,
  })
  const t = useI18n()

  useEffect(() => {
    let previous = ''
    const remove = onTimeUpdate((time, isPlayedStop) => {
      const active = time >= 0
      const key = `${active}_${isPlayedStop}`
      if (previous == key) return
      previous = key
      setExitTimeInfo({
        cancelText: active ? t('timeout_exit_btn_cancel') : (isPlayedStop ? t('timeout_exit_btn_wait_cancel') : ''),
        confirmText: active ? t('timeout_exit_btn_update') : '',
        isPlayedStop,
        active,
      })
    })

    return () => {
      remove()
    }
  }, [t])

  return exitTimeInfo
}

export interface TimeoutExitEditModalType {
  show: () => void
}
interface TimeoutExitEditModalProps {
  timeInfo: ReturnType<typeof useTimeInfo>
}

export default forwardRef<TimeoutExitEditModalType, TimeoutExitEditModalProps>(({ timeInfo }, ref) => {
  const alertRef = useRef<ConfirmAlertType>(null)
  const timeInputRef = useRef<InputType>(null)
  const [timeText, setTimeText] = useState('')
  const [error, setError] = useState(false)
  const [visible, setVisible] = useState(false)
  const t = useI18n()
  const theme = useTheme()

  useEffect(() => { alertRef.current?.setVisible(visible) }, [visible])
  useImperativeHandle(ref, () => ({
    show() {
      setTimeText(settingState.setting['player.timeoutExit'] || '')
      setError(false)
      setVisible(true)
    },
  }))

  const handleCancel = () => {
    if (timeInfo.isPlayedStop) {
      cancelTimeoutExit()
      return
    }
    if (!timeInfo.active) return
    stopTimeoutExit()
    toast(t('timeout_exit_tip_cancel'))
  }
  const handleConfirm = () => {
    const timeStr = timeText.trim()
    if (!rxp.test(timeStr) || Number(timeStr) > MAX_MIN) {
      setError(true)
      timeInputRef.current?.focus()
      return
    }
    const time = Number(timeStr)
    cancelTimeoutExit()
    startTimeoutExit(time * 60)
    toast(t('timeout_exit_tip_on', { time: formatTime(getTimeoutExitTime()) }))
    updateSetting({ 'player.timeoutExit': String(time) })
    alertRef.current?.setVisible(false)
  }

  return (
    visible
      ? <ConfirmAlert
          ref={alertRef}
          onHide={() => { setVisible(false) }}
          cancelText={timeInfo.cancelText}
          confirmText={timeInfo.confirmText}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        >
          <View style={styles.alertContent}>
            <Status />
            <View style={styles.inputContent}>
              <Input
                ref={timeInputRef}
                accessibilityLabel={t('timeout_exit_input_tip')}
                placeholder={t('timeout_exit_input_tip')}
                keyboardType="number-pad"
                returnKeyType="done"
                value={timeText}
                onChangeText={text => { setTimeText(text); setError(false) }}
                onSubmitEditing={handleConfirm}
                style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
              />
              <Text style={styles.inputLabel}>{t('timeout_exit_min')}</Text>
            </View>
            {error
              ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" size={12} style={styles.hint} color={theme['q-accent-text']}>{t('timeout_exit_range')}</Text>
              : <Text size={12} style={styles.hint} color={theme['c-font-label']}>{t('timeout_exit_range')}</Text>}
            <View style={styles.presets}>
              {[15, 30, 60, 90].map(minutes => (
                <TouchableOpacity
                  key={minutes}
                  accessibilityRole="button"
                  accessibilityState={{ selected: Number(timeText) == minutes }}
                  style={{ ...styles.preset, backgroundColor: Number(timeText) == minutes ? theme['q-surface-tint'] : theme['c-primary-input-background'] }}
                  onPress={() => { setTimeText(String(minutes)); setError(false) }}
                >
                  <Text size={12} color={Number(timeText) == minutes ? theme['q-accent-text'] : theme['c-font']}>{minutes} {t('timeout_exit_min')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Setting />
          </View>
        </ConfirmAlert>
      : null
  )
})

const styles = createStyle({
  hint: { marginTop: 8 },
  presets: { flexDirection: 'row', gap: 6, marginVertical: 12 },
  preset: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alertContent: {
    flexShrink: 1,
    flexDirection: 'column',
  },
  tip: {
    marginBottom: 8,
  },
  checkbox: {
    marginTop: 5,
  },
  inputContent: {
    marginTop: 8,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    // borderRadius: 4,
    // paddingTop: 2,
    // paddingBottom: 2,
  },
  inputLabel: {
    marginLeft: 8,
  },
})


