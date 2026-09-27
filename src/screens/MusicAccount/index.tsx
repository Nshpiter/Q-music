import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Linking, StyleSheet, View } from 'react-native'
import { WebView, type WebViewProps } from 'react-native-webview'

import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { pop } from '@/navigation'
import { isMusicAccountConnected, logoutMusicAccount, type MusicAccountProvider } from '@/core/musicAccount'
import { getLoginAppUrl, getQQCallbackUrl, isQQCallback, LOGIN_URLS } from '@/core/musicAccount/login'
import { isQQLoginPage, QQ_AUTH_BRIDGE, QQ_RESUME_AUTH, QQ_START_AUTH, QQ_STOP_AUTH } from '@/core/musicAccount/qqAuthorization'
import Playlists from './Playlists'
import { isQQDailyOrigin, QQ_DAILY_BRIDGE, QQ_DAILY_USER_AGENT } from '@/core/musicAccount/dailyAuthorization'

const PROVIDERS: MusicAccountProvider[] = ['tx', 'wy']

// 独立挂载每个平台，避免切换账号页时遗留网页历史、加载状态或回跳计时器。
export const LoginPage = ({ provider, connected, onConnected, initialUrl = LOGIN_URLS[provider], onDailyKey }: { provider: MusicAccountProvider, connected: boolean, onConnected: () => void, initialUrl?: string, onDailyKey?: (key: string) => void }) => {
  const theme = useTheme()
  const t = useI18n()
  const [url, setUrl] = useState<string>(initialUrl)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [appError, setAppError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [authorization, setAuthorization] = useState<'idle' | 'pending' | 'expired' | 'unavailable'>('idle')
  const webview = useRef<WebView<WebViewProps>>(null)
  const active = useRef(true)
  const awaitingQQ = useRef(false)
  const lastLaunch = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const refreshConnection = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(onConnected, 800)
  }, [onConnected])

  useEffect(() => {
    active.current = true
    const appState = AppState.addEventListener('change', state => {
      if (state == 'active') {
        if (awaitingQQ.current) webview.current?.injectJavaScript(QQ_RESUME_AUTH)
        refreshConnection()
      }
    })
    const link = Linking.addEventListener('url', event => {
      if (!awaitingQQ.current || !isQQCallback(event.url)) return
      // QQ 音乐只恢复自己发起的会话，不加载外部回调携带的票据。
      const target = provider == 'tx' ? null : getQQCallbackUrl(event.url)
      if (target) { setUrl(target); setFailed(false); setAppError(false) } else webview.current?.injectJavaScript(QQ_RESUME_AUTH)
      refreshConnection()
    })
    return () => {
      active.current = false
      appState.remove()
      link.remove()
      clearTimeout(timer.current)
    }
  }, [provider, refreshConnection])

  useEffect(() => {
    if (connected) {
      awaitingQQ.current = false
      setAuthorization('idle')
      webview.current?.injectJavaScript(QQ_STOP_AUTH)
    }
  }, [connected])

  useEffect(() => {
    if (authorization != 'pending') return
    // Cookie 可能在页面加载结束后的异步授权中写入，仅在等待授权且前台时检查。
    const interval = setInterval(() => { if (AppState.currentState == 'active') onConnected() }, 2000)
    const timeout = setTimeout(() => {
      awaitingQQ.current = false
      setAuthorization('expired')
      webview.current?.injectJavaScript(QQ_STOP_AUTH)
    }, 120_000)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, [authorization, onConnected])

  const openApp = (target: string) => {
    const appUrl = getLoginAppUrl(target, provider)
    if (!appUrl) return
    if (provider == 'tx' && /^wtloginmqq:/i.test(appUrl) && !/[?&]qrcode=/.test(appUrl)) {
      webview.current?.injectJavaScript(QQ_START_AUTH)
      return
    }
    setLoading(false)
    // 部分网页同时使用窗口和顶层导航，避免一次点击重复拉起客户端。
    if (Date.now() - lastLaunch.current < 1200) return
    lastLaunch.current = Date.now()
    awaitingQQ.current = /^wtloginmqq:/i.test(appUrl)
    setAppError(false)
    void Linking.openURL(appUrl).catch(() => {
      if (!active.current) return
      awaitingQQ.current = false
      setAuthorization('idle')
      webview.current?.injectJavaScript(QQ_STOP_AUTH)
      setAppError(true)
    })
  }

  const retry = () => {
    awaitingQQ.current = false
    lastLaunch.current = 0
    setFailed(false)
    setAppError(false)
    setAuthorization('idle')
    setUrl(initialUrl)
    setReloadKey(key => key + 1)
  }

  return <View style={styles.loginPage}>
    {appError ? <Text accessibilityLiveRegion="polite" size={12} color={theme['q-text-secondary']} style={styles.notice}>{t('music_account_app_unavailable')}</Text> : null}
    {authorization != 'idle' && !connected ? <View style={styles.authNotice}>
      {authorization == 'pending' ? <ActivityIndicator size="small" color={theme['q-accent']} /> : null}
      <Text accessibilityLiveRegion="polite" size={12} color={theme['q-text-secondary']} style={styles.authText}>{t(authorization == 'pending' ? 'music_account_qq_pending' : authorization == 'expired' ? 'music_account_qq_expired' : 'music_account_qq_unavailable')}</Text>
      <Button onPress={retry} style={styles.refresh}><Text size={12} color={theme['q-accent-text']}>{t('list_retry')}</Text></Button>
    </View> : null}
    <View style={[styles.webWrap, { borderColor: theme['q-outline'], backgroundColor: theme['c-content-background'] }]}>
      <WebView
        ref={webview}
        key={reloadKey}
        source={{ uri: url }}
        style={styles.webview}
        originWhitelist={['*']}
        userAgent={onDailyKey ? QQ_DAILY_USER_AGENT : 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'}
        onShouldStartLoadWithRequest={request => {
          if (isQQCallback(request.url)) {
            webview.current?.injectJavaScript(QQ_RESUME_AUTH)
            refreshConnection()
            return false
          }
          if (/^https?:/i.test(request.url) || request.url == 'about:blank') return true
          openApp(request.url)
          return false
        }}
        onOpenWindow={event => {
          const target = event.nativeEvent.targetUrl
          // 授权和 Cookie 留在同一个 WebView 中，避免跳到外部浏览器丢失登录态。
          if (/^https?:\/\//i.test(target)) setUrl(target)
          else openApp(target)
        }}
        setSupportMultipleWindows
        onMessage={event => {
          if (onDailyKey && isQQDailyOrigin(event.nativeEvent.url)) {
            try {
              const message = JSON.parse(event.nativeEvent.data) as { type?: string, key?: string }
              if (message.type == 'qq-daily-key' && typeof message.key == 'string' && /^qmk-[A-Za-z0-9_-]{12,1024}$/.test(message.key)) onDailyKey(message.key)
            } catch {}
            return
          }
          if (provider != 'tx' || !isQQLoginPage(event.nativeEvent.url)) return
          try {
            const message = JSON.parse(event.nativeEvent.data) as { type?: string, url?: string }
            if (message.type == 'qq-open' && typeof message.url == 'string' && /^wtloginmqq:\/\/ptlogin\/qlogin\?qrcode=/.test(message.url)) openApp(message.url)
            else if (message.type == 'qq-pending') { setAppError(false); setAuthorization('pending') } else if (message.type == 'qq-expired' || message.type == 'qq-unavailable') {
              awaitingQQ.current = false
              setAuthorization(message.type == 'qq-expired' ? 'expired' : 'unavailable')
            }
          } catch {}
        }}
        onLoadStart={() => { setLoading(true) }}
        onLoadEnd={() => {
          if (provider == 'tx') webview.current?.injectJavaScript(QQ_AUTH_BRIDGE)
          if (onDailyKey) webview.current?.injectJavaScript(QQ_DAILY_BRIDGE)
          setLoading(false)
          refreshConnection()
        }}
        onError={() => { setFailed(true); setLoading(false) }}
        onHttpError={event => {
          if (event.nativeEvent.url == url) { setFailed(true); setLoading(false) }
        }}
        incognito={false}
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        domStorageEnabled
      />
      {loading && !failed ? <View pointerEvents="none" style={[styles.loading, { backgroundColor: theme['q-surface-raised'] }]}><ActivityIndicator size="small" color={theme['q-accent']} /></View> : null}
      {failed ? <View style={[styles.failure, { backgroundColor: theme['c-content-background'] }]}>
        <Icon name="help" size={28} color={theme['q-text-secondary']} />
        <Text size={14} style={styles.failureText}>{t('music_account_load_failed')}</Text>
        <Button onPress={retry} style={styles.retry}><Text color={theme['q-accent-text']}>{t('list_retry')}</Text></Button>
      </View> : null}
    </View>
    <View style={styles.footer}>
      <Text size={11} color={theme['q-text-secondary']} style={styles.tip}>{t(onDailyKey ? 'daily_authorization_tip' : 'setting_music_account_tip')}</Text>
      <Button onPress={retry} accessibilityLabel={t('list_retry')} style={styles.refresh}><Icon accessible={false} name="available_updates" size={18} color={theme['q-text-secondary']} /></Button>
    </View>
  </View>
}

export default ({ componentId, initialProvider = 'tx' }: { componentId: string, initialProvider?: MusicAccountProvider }) => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [provider, setProvider] = useState<MusicAccountProvider>(initialProvider)
  const [connected, setConnected] = useState<Record<MusicAccountProvider, boolean | null>>({ tx: null, wy: null })
  const [revision, setRevision] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const mounted = useRef(false)
  const checkId = useRef(0)

  const checkConnections = useCallback(() => {
    const id = ++checkId.current
    void Promise.all(PROVIDERS.map(async p => [p, await isMusicAccountConnected(p)] as const)).then(results => {
      if (mounted.current && checkId.current == id) setConnected(Object.fromEntries(results) as Record<MusicAccountProvider, boolean>)
    })
  }, [])
  useEffect(() => {
    mounted.current = true
    checkConnections()
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

  return <View style={[styles.container, { paddingTop: statusBarHeight, backgroundColor: theme['c-main-background'] }]}>
    <View style={styles.header}>
      <Button style={styles.backBtn} accessibilityLabel={t('back')} onPress={() => { void pop(componentId) }}><Icon accessible={false} name="chevron-left" size={24} color={theme['c-font']} /></Button>
      <Text size={16} style={styles.heading}>{t('setting_music_account_title')}</Text>
      <View style={styles.backBtn} />
    </View>
    <View style={styles.providerBar}>
      {PROVIDERS.map(p => <Button key={p} disabled={syncing || loggingOut} accessibilityRole="tab" accessibilityState={{ selected: p == provider }} onPress={() => { setProvider(p); setShowLogin(false) }} style={[styles.providerBtn, { backgroundColor: p == provider ? theme['q-surface-tint'] : theme['q-surface-raised'], borderColor: p == provider ? theme['q-accent'] : theme['q-outline'] }]}>
        <Text size={13} color={p == provider ? theme['q-accent-text'] : theme['c-font-label']}>{t(p == 'tx' ? 'setting_music_account_qq' : 'setting_music_account_netease')}</Text>
        <Text size={10} color={theme['q-text-secondary']}>{connected[p] == null ? ' ' : t(connected[p] ? 'setting_music_account_connected' : 'setting_music_account_disconnected')}</Text>
      </Button>)}
      {connected[provider] ? <Button disabled={loggingOut || syncing} style={styles.logoutBtn} onPress={() => { setShowLogin(false); void logout().catch(() => {}) }}><Text size={12} color={theme['q-accent-text']}>{t('setting_music_account_logout')}</Text></Button> : null}
    </View>
    {connected[provider] && !showLogin ? <Playlists key={`${provider}-${revision}`} provider={provider} onBusyChange={setSyncing} onLogin={() => { setShowLogin(true) }} onOpenLibrary={() => { void pop(componentId) }} /> : <>
      {showLogin ? <Button style={styles.returnLists} onPress={() => { setShowLogin(false); checkConnections() }}><Text size={13} color={theme['q-accent-text']}>{t('account_lists_return')}</Text></Button> : null}
      <LoginPage key={`${provider}-${revision}`} provider={provider} connected={connected[provider] === true && !showLogin} onConnected={checkConnections} />
    </>}
  </View>
}

const styles = StyleSheet.create({
  returnLists: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  loginPage: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 8 },
  heading: { flex: 1, textAlign: 'center', fontWeight: '600' },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  providerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  providerBtn: { minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center', gap: 4 },
  logoutBtn: { marginLeft: 'auto', minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  webWrap: { flex: 1, overflow: 'hidden', marginHorizontal: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  webview: { flex: 1 },
  loading: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  failure: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 20 },
  failureText: { marginTop: 16, textAlign: 'center' },
  retry: { paddingHorizontal: 24, minHeight: 48, justifyContent: 'center' },
  notice: { paddingHorizontal: 16, paddingBottom: 10, lineHeight: 18 },
  authNotice: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 10 },
  authText: { flex: 1, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 6, paddingVertical: 8 },
  tip: { flex: 1, lineHeight: 16 },
  refresh: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
})
