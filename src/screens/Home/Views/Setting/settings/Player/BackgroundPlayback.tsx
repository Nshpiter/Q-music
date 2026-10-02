import { memo, useEffect, useState } from 'react'
import { AppState, Linking, View } from 'react-native'
import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { isNotificationsEnabled, isIgnoringBatteryOptimization, requestNotificationPermission, requestIgnoreBatteryOptimization } from '@/utils/nativeModules/utils'
import { toast } from '@/utils/tools'

export default memo(() => {
  const t = useI18n()
  const [notification, setNotification] = useState<boolean | null>(null)
  const [battery, setBattery] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = () => {
      void Promise.all([isNotificationsEnabled().catch(() => null), isIgnoringBatteryOptimization().catch(() => null)]).then(([n, b]) => {
        if (active) { setNotification(n); setBattery(b) }
      })
    }
    refresh()
    const subscription = AppState.addEventListener('change', state => { if (state == 'active') refresh() })
    return () => { active = false; subscription.remove() }
  }, [])
  const request = async(forBattery: boolean) => {
    setBusy(true)
    try {
      const result = await (forBattery ? requestIgnoreBatteryOptimization() : requestNotificationPermission())
      if (forBattery) setBattery(result == 'enabled')
      else setNotification(result == 'enabled')
      if (result == 'unavailable') toast(t('permission_settings_unavailable'))
    } finally { setBusy(false) }
  }
  return <SubTitle title={t('background_playback_title')}>
    <View style={{ gap: 10 }}>
      <Text size={12}>{t('background_playback_help')}</Text>
      <Text size={12}>{t('background_notification')} · {t(notification === true ? 'permission_enabled' : notification === false ? 'permission_not_enabled' : 'permission_unknown')}</Text>
      <Text size={12}>{t('background_battery')} · {t(battery === true ? 'permission_enabled' : 'permission_unknown')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button disabled={busy} onPress={() => { void request(false) }}>{t('background_notification')}</Button>
        <Button disabled={busy} onPress={() => { void request(true) }}>{t('background_battery')}</Button>
        <Button onPress={() => { void Linking.openSettings().catch(() => { toast(t('permission_settings_unavailable')) }) }}>{t('background_system_settings')}</Button>
      </View>
    </View>
  </SubTitle>
})
