import { tipDialog } from '@/utils/tools'
import { memo, useEffect, useState } from 'react'
import { AppState, View } from 'react-native'
import Button from '../../components/Button'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { enableStatusBarLyric, getStatusBarLyricStatus, type StatusBarLyricStatus } from '@/core/statusBarLyric'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<StatusBarLyricStatus>('disabled')
  useEffect(() => {
    let active = true
    const refresh = () => { void getStatusBarLyricStatus().then(value => { if (active) setStatus(value) }) }
    refresh()
    const subscription = AppState.addEventListener('change', state => { if (state == 'active') refresh() })
    // 仅设置页可见时检查连接状态，不在后台增加轮询。
    const timer = setInterval(() => { if (AppState.currentState == 'active') refresh() }, 3000)
    return () => { active = false; subscription.remove(); clearInterval(timer) }
  }, [])
  const reconnect = async() => {
    setBusy(true)
    try {
      setStatus(await enableStatusBarLyric(true))
    } finally { setBusy(false) }
  }
  return <View style={{ marginHorizontal: 16, paddingVertical: 12, gap: 8 }}>
    <Text size={14} color={theme['q-text-primary']}>{t('status_bar_lyric_title')}</Text>
    <Text size={12} color={theme['q-text-secondary']}>{t(`status_bar_lyric_${status}`)}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {status != 'connected' && status != 'unsupported' && status != 'not_installed' ? <Button disabled={busy} onPress={() => { void reconnect() }}>{t('status_bar_lyric_retry')}</Button> : null}
      <Button onPress={() => { void tipDialog({ title: t('status_bar_lyric_title'), message: t('status_bar_lyric_help') }) }}>{t('help')}</Button>
    </View>
  </View>
})
