import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { getQQDailyKeyStatus, saveQQDailyKey, clearQQDailyKey } from '@/core/musicAccount/daily'
import type { MusicAccountProvider } from '@/core/musicAccount'
import { LoginPage } from '@/screens/MusicAccount'
import { QQ_DAILY_PAGE } from '@/core/musicAccount/dailyAuthorization'

const noop = () => {}
export default ({ provider, onClose, onChanged, onLogin }: {
  provider: MusicAccountProvider
  onClose: () => void
  onChanged: () => void
  onLogin: () => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const [status, setStatus] = useState({ configured: false, available: true })
  const [authorizing, setAuthorizing] = useState(false)
  const [manual, setManual] = useState(false)
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const busy = useRef(false)
  const alive = useRef(true)
  const request = useRef<AbortController>()
  useEffect(() => {
    void getQQDailyKeyStatus().then(value => { if (alive.current) setStatus(value) }).catch(() => { if (alive.current) setStatus({ configured: false, available: false }) })
    return () => { alive.current = false; request.current?.abort() }
  }, [])
  const save = useCallback(async(value: string) => {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setNotice('')
    const controller = new AbortController()
    request.current = controller
    try {
      await saveQQDailyKey(value, controller.signal)
      if (!alive.current || controller.signal.aborted) return
      setKey('')
      setAuthorizing(false)
      setManual(false)
      setStatus({ available: true, configured: true })
      setNotice(t('daily_key_saved'))
      onChanged()
    } catch (error) {
      if (!alive.current || controller.signal.aborted) return
      const reason = error instanceof Error ? error.message : ''
      setNotice(t(reason == 'login_required' || reason == 'account_changed' ? 'daily_login_needed' : reason == 'credential_storage' ? 'daily_key_storage' : reason == 'invalid_key' ? 'daily_key_invalid' : 'daily_key_unavailable'))
    } finally {
      busy.current = false
      if (alive.current) setSaving(false)
    }
  }, [onChanged, t])
  const close = () => {
    request.current?.abort()
    if (authorizing) { setAuthorizing(false); setSaving(false) } else onClose()
  }
  return <Modal visible animationType="slide" onRequestClose={close}>
    <SafeAreaView style={[styles.container, { backgroundColor: theme['c-main-background'] }]}>
      <View style={styles.header}>
        <Button accessibilityLabel={t('back')} style={styles.icon} onPress={close}><Icon name="chevron-left" size={24} color={theme['q-text-primary']} /></Button>
        <Text size={17} style={styles.title}>{t(authorizing ? 'daily_key_authorize' : 'daily_settings')}</Text>
        <View style={styles.icon} />
      </View>
      {notice ? <Text accessibilityLiveRegion="polite" size={12} color={theme['q-accent-text']} style={styles.notice}>{notice}</Text> : null}
      {saving ? <View style={styles.busy}><ActivityIndicator color={theme['q-accent']} /><Text size={12}>{t('daily_key_saving')}</Text></View> : null}
      {authorizing ? <LoginPage provider="tx" initialUrl={QQ_DAILY_PAGE} connected={false} onConnected={noop} onDailyKey={value => { void save(value) }} /> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text size={22} style={styles.heading}>{t(provider == 'tx' ? 'setting_music_account_qq' : 'setting_music_account_netease')}</Text>
        <Text size={13} color={theme['q-text-secondary']} style={styles.description}>{t(provider == 'tx' ? 'daily_qq_explanation' : 'daily_wy_explanation')}</Text>
        <Button style={[styles.button, { backgroundColor: theme['q-surface-tint'] }]} onPress={onLogin}><Text color={theme['q-accent-text']}>{t('daily_manage_account')}</Text><Icon name="chevron-right" size={18} color={theme['q-accent-text']} /></Button>
        {provider == 'tx' ? <View style={[styles.card, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]}>
          <View style={styles.row}><Text size={17} style={styles.heading}>{t('daily_official_daily')}</Text><Text size={12} color={theme['q-accent-text']}>{t(status.configured ? 'daily_key_enabled' : 'daily_key_disabled')}</Text></View>
          <Text size={12} color={theme['q-text-secondary']} style={styles.description}>{t('daily_key_description')}</Text>
          {!status.available ? <Text size={12} style={styles.description}>{t('daily_key_storage')}</Text> : null}
          <Button disabled={saving || !status.available} style={[styles.button, { backgroundColor: theme['q-accent'] }]} onPress={() => { setAuthorizing(true); setNotice('') }}><Text color={theme['q-on-accent']}>{t('daily_key_authorize')}</Text></Button>
          <Button disabled={saving} style={styles.link} onPress={() => { setManual(value => !value) }}><Text size={12} color={theme['q-text-secondary']}>{t('daily_key_manual')}</Text></Button>
          {manual ? <View style={styles.manual}>
            <TextInput secureTextEntry autoCapitalize="none" autoCorrect={false} value={key} onChangeText={setKey} placeholder="qmk-…" accessibilityLabel={t('daily_key_input')} placeholderTextColor={theme['q-text-secondary']} style={[styles.input, { color: theme['q-text-primary'], borderColor: theme['q-outline'] }]} />
            <Button disabled={saving || !key.trim() || !status.available} style={[styles.button, { backgroundColor: theme['q-surface-tint'] }]} onPress={() => { void save(key) }}><Text color={theme['q-accent-text']}>{t('daily_key_save')}</Text></Button>
          </View> : null}
          {status.configured ? <Button disabled={saving} style={styles.link} onPress={() => { void clearQQDailyKey().then(() => { if (alive.current) { setStatus(value => ({ ...value, configured: false })); onChanged() } }).catch(() => { if (alive.current) setNotice(t('daily_key_storage')) }) }}><Text size={12} color={theme['q-text-secondary']}>{t('daily_key_disable')}</Text></Button> : null}
        </View> : null}
        <Text size={12} color={theme['q-text-secondary']} style={styles.description}>{t('daily_fallback_explanation')}</Text>
      </ScrollView>}
    </SafeAreaView>
  </Modal>
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontWeight: '600' },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  heading: { fontWeight: '700' },
  description: { lineHeight: 21 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 18, gap: 12, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  button: { minHeight: 48, borderRadius: 24, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  link: { minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  manual: { gap: 10 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  busy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 },
  notice: { paddingHorizontal: 20, paddingVertical: 8, lineHeight: 19 },
})
