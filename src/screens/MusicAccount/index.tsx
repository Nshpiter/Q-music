import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, StyleSheet, View } from 'react-native'

import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { pop } from '@/navigation'
import { clearProviderCookies, isMusicAccountConnected, logoutMusicAccount, type MusicAccountProvider } from '@/core/musicAccount'
import { LOGIN_URLS } from '@/core/musicAccount/login'
import Playlists from './Playlists'
import KugouLogin from './KugouLogin'
import LoginPage from './LoginPage'
import AccountTransfer from './AccountTransfer'
import DailySettings from '@/screens/Home/Views/Search/BlankView/DailySettings'
import { getDailyProvider, setDailyProvider, type DailyProvider } from '@/core/musicAccount/daily'
import { toast } from '@/utils/tools'

const PROVIDERS: MusicAccountProvider[] = ['tx', 'wy', 'kg']

export default ({ componentId, initialProvider = 'tx' }: { componentId: string, initialProvider?: MusicAccountProvider }) => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [provider, setProvider] = useState<MusicAccountProvider>(initialProvider)
  const [connected, setConnected] = useState<Record<MusicAccountProvider, boolean | null>>({ tx: null, wy: null, kg: null })
  const [dailyProvider, setSelectedDailyProvider] = useState<DailyProvider>('tx')
  const [dailySettings, setDailySettings] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [revision, setRevision] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [qqLoginMethod, setQQLoginMethod] = useState<'qq' | 'wechat'>('qq')
  const mounted = useRef(false)
  const checkId = useRef(0)

  useEffect(() => {
    if (!transferring) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setTransferring(false); return true })
    return () => { subscription.remove() }
  }, [transferring])

  const onTransferred = () => {
    setConnected(value => ({ ...value, tx: true }))
    setTransferring(false)
    setRevision(value => value + 1)
    toast('已导入 QQ 音乐账号')
  }

  const checkConnections = useCallback(() => {
    const id = ++checkId.current
    void Promise.all(PROVIDERS.map(async p => [p, await isMusicAccountConnected(p)] as const)).then(results => {
      if (mounted.current && checkId.current == id) setConnected(Object.fromEntries(results) as Record<MusicAccountProvider, boolean>)
    })
  }, [])
  useEffect(() => {
    mounted.current = true
    checkConnections()
    void getDailyProvider().then(value => { if (mounted.current) setSelectedDailyProvider(value) })
    return () => { mounted.current = false }
  }, [checkConnections, revision])

  const logout = async() => {
    setLoggingOut(true)
    try {
      await logoutMusicAccount(provider)
      if (mounted.current) setRevision(value => value + 1)
    } finally {
      if (mounted.current) setLoggingOut(false)
    }
  }

  const reconnect = async() => {
    // 失效 Cookie 仍可能存在；先清除再打开网页，避免轮询将旧会话判成新授权。
    setLoggingOut(true)
    try {
      if (provider == 'kg') await logoutMusicAccount(provider)
      else await clearProviderCookies(provider)
      if (mounted.current) {
        setConnected(value => ({ ...value, [provider]: false }))
        setRevision(value => value + 1)
      }
    } finally {
      if (mounted.current) setLoggingOut(false)
    }
  }

  if (transferring) {
    return <View style={[styles.container, { paddingTop: statusBarHeight, backgroundColor: theme['c-content-background'] }]}>
    <View style={styles.header}>
      <Button style={styles.backBtn} accessibilityLabel={t('back')} onPress={() => { setTransferring(false) }}><Icon name="chevron-left" size={24} color={theme['c-font']} /></Button>
      <Text size={16} style={styles.heading}>从电脑连接账号</Text><View style={styles.backBtn} />
    </View>
    <AccountTransfer onConnected={onTransferred} />
    </View>
  }

  return <View style={[styles.container, { paddingTop: statusBarHeight, backgroundColor: theme['c-content-background'] }]}>
    <View style={styles.header}>
      <Button style={styles.backBtn} accessibilityLabel={t('back')} onPress={() => { void pop(componentId) }}><Icon accessible={false} name="chevron-left" size={24} color={theme['c-font']} /></Button>
      <Text size={16} style={styles.heading}>{t('setting_music_account_title')}</Text>
      <View style={styles.backBtn} />
    </View>
    <View style={styles.providerBar}>
      {PROVIDERS.map(p => <Button key={p} disabled={syncing || loggingOut} accessibilityRole="tab" accessibilityState={{ selected: p == provider }} onPress={() => { setProvider(p) }} style={[styles.providerBtn, { backgroundColor: p == provider ? theme['q-surface-tint'] : theme['q-surface-raised'], borderColor: p == provider ? theme['q-accent'] : theme['q-outline'] }]}>
        <Text size={13} color={p == provider ? theme['q-accent-text'] : theme['c-font-label']}>{t(p == 'kg' ? 'setting_music_account_kugou' : p == 'tx' ? 'setting_music_account_qq' : 'setting_music_account_netease')}</Text>
        <Text size={10} color={theme['q-text-secondary']}>{connected[p] == null ? ' ' : t(connected[p] ? 'setting_music_account_connected' : 'setting_music_account_disconnected')}</Text>
      </Button>)}
      {connected[provider] ? <Button disabled={loggingOut || syncing} style={styles.logoutBtn} onPress={() => { void logout().catch(() => {}) }}><Text size={12} color={theme['q-accent-text']}>{t('setting_music_account_logout')}</Text></Button> : null}
    </View>
    <View style={styles.recommendActions}>
      <Button disabled={loggingOut || syncing} accessibilityState={{ selected: dailyProvider == provider }} style={[styles.recommendButton, { backgroundColor: theme['q-surface-tint'] }]} onPress={() => {
        void setDailyProvider(provider).then(() => { if (mounted.current) { setSelectedDailyProvider(provider); toast(t('daily_provider_saved')) } }).catch(() => { toast(t('daily_preference_failed')) })
      }}><Text size={12} color={theme['q-accent-text']}>{t(dailyProvider == provider ? 'daily_provider_current' : 'daily_provider_use')}</Text></Button>
      <Button disabled={loggingOut || syncing} style={styles.recommendButton} onPress={() => { setDailySettings(true) }}><Text size={12} color={theme['q-text-secondary']}>{t(provider == 'tx' ? 'daily_official_daily' : 'daily_settings')} ›</Text></Button>
    </View>
    <DailySettings visible={dailySettings} provider={provider} onClose={() => { setDailySettings(false) }} onChanged={checkConnections} />
    {provider == 'tx' && connected.tx ? <View style={styles.recommendActions}><Button disabled={loggingOut || syncing} style={styles.recommendButton} onPress={() => { setTransferring(true) }}><Text size={12} color={theme['q-accent-text']}>从电脑更换账号 ›</Text></Button></View> : null}
    {connected[provider] ? <Playlists key={`${provider}-${revision}`} provider={provider} onBusyChange={setSyncing} onLogin={() => { void reconnect().catch(() => {}) }} onOpenLibrary={() => { void pop(componentId) }} /> : <>
      {provider == 'tx' ? <View style={styles.loginMethods}>
        {(['qq', 'wechat'] as const).map(method => <Button key={method} accessibilityRole="tab" accessibilityState={{ selected: qqLoginMethod == method }} onPress={() => { setQQLoginMethod(method) }} style={[styles.loginMethod, { backgroundColor: qqLoginMethod == method ? theme['q-surface-tint'] : theme['q-surface-raised'] }]}>
          <Text size={13} color={qqLoginMethod == method ? theme['q-accent-text'] : theme['c-font-label']}>{method == 'qq' ? 'QQ 登录' : '微信登录'}</Text>
        </Button>)}
      </View> : null}
      {provider == 'tx' && qqLoginMethod == 'wechat' ? <AccountTransfer onConnected={onTransferred} /> : provider == 'kg' ? <KugouLogin key={revision} onConnected={checkConnections} /> : <LoginPage key={`${provider}-${revision}-${qqLoginMethod}`} provider={provider} initialUrl={LOGIN_URLS[provider]} connected={false} onConnected={checkConnections} />}
    </>}
  </View>
}

const styles = StyleSheet.create({
  recommendActions: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  recommendButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  loginMethods: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  loginMethod: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 8 },
  heading: { flex: 1, textAlign: 'center', fontWeight: '600' },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  providerBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  providerBtn: { flex: 1, minWidth: 88, minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center', gap: 4 },
  logoutBtn: { marginLeft: 'auto', minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
})
