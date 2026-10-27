import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Linking, NativeModules, PermissionsAndroid, Platform, StyleSheet, View } from 'react-native'
import { WebView, type WebViewProps } from 'react-native-webview'

import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import type { MusicAccountProvider } from '@/core/musicAccount'
import { getLoginAppUrl, getQQCallbackUrl, isQQCallback, LOGIN_URLS, normalizeLoginNavigation } from '@/core/musicAccount/login'
import { isQQLoginPage, QQ_AUTH_BRIDGE, QQ_RESUME_AUTH, QQ_START_AUTH, QQ_STOP_AUTH } from '@/core/musicAccount/qqAuthorization'
import { isQQDailyOrigin, QQ_DAILY_BRIDGE, QQ_DAILY_USER_AGENT } from '@/core/musicAccount/dailyAuthorization'
import { isWechatLoginPage, getWechatAppUrl, getWechatQrScript } from '@/core/musicAccount/wechatAuthorization'


// 独立挂载每个平台，避免切换账号页时遗留网页历史、加载状态或回跳计时器。
const LoginPage = ({ provider, connected, onConnected, initialUrl = LOGIN_URLS[provider], onDailyKey }: { provider: MusicAccountProvider, connected: boolean, onConnected: () => void, initialUrl?: string, onDailyKey?: (key: string) => void }) => {
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
  const wechatLogin = provider == 'tx' && isWechatLoginPage(initialUrl)
  const supportsQQ = provider == 'tx' || provider == 'wy'
  const [wechatBusy, setWechatBusy] = useState(false)
  const [wechatNotice, setWechatNotice] = useState('')
  const exportingQR = useRef(false)
  const qrRevision = useRef(0)
  const qrTimer = useRef<ReturnType<typeof setTimeout>>()
  const pageUrl = useRef(initialUrl)
  const invalidateWechatQR = useCallback(() => { qrRevision.current++ }, [])

  const exportWechatQR = async() => {
    if (exportingQR.current || wechatBusy) return
    const revision = ++qrRevision.current
    exportingQR.current = true
    setWechatBusy(true)
    setWechatNotice('')
    try {
      if (Platform.OS == 'android' && Number(Platform.Version) < 29) {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE)
        if (!active.current || revision != qrRevision.current) return
        if (granted != PermissionsAndroid.RESULTS.GRANTED) throw new Error('permission')
      }
    } catch {
      if (active.current && revision == qrRevision.current) {
        exportingQR.current = false
        setWechatBusy(false)
        setWechatNotice('未获得图片保存权限。可截屏后在电脑或另一台设备展示，再用当前手机的微信摄像头扫码。')
      }
      return
    }
    if (!active.current || revision != qrRevision.current) return
    qrTimer.current = setTimeout(() => {
      if (!active.current || revision != qrRevision.current) return
      exportingQR.current = false
      setWechatBusy(false)
      setWechatNotice('二维码尚未就绪，请等待网页加载或刷新后重试。')
    }, 5000)
    webview.current?.injectJavaScript(getWechatQrScript(revision))
  }

  const saveWechatQR = async(image: string) => {
    const revision = qrRevision.current
    try {
      await NativeModules.UtilsModule.saveWechatLoginQr(image)
      if (!active.current || revision != qrRevision.current) return
      setWechatNotice('二维码已保存到 Pictures/Q-music。请在电脑或另一台设备展示这张图片，用当前手机的微信摄像头扫码，确认后返回 Q-music。期间不要刷新本页；过期后需重新保存。')
    } catch {
      if (active.current && revision == qrRevision.current) setWechatNotice('无法保存二维码。可截屏后在另一台设备展示，用当前手机的微信摄像头扫码。')
    } finally {
      if (active.current && revision == qrRevision.current) setWechatBusy(false)
    }
  }

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
      const target = provider == 'tx' ? null : getQQCallbackUrl(event.url, provider)
      if (target) { setUrl(target); setFailed(false); setAppError(false) } else webview.current?.injectJavaScript(QQ_RESUME_AUTH)
      refreshConnection()
    })
    return () => {
      active.current = false
      invalidateWechatQR()
      appState.remove()
      link.remove()
      clearTimeout(timer.current)
      clearTimeout(qrTimer.current)
      exportingQR.current = false
    }
  }, [provider, refreshConnection, invalidateWechatQR])

  useEffect(() => {
    if (connected) {
      awaitingQQ.current = false
      setAuthorization('idle')
      webview.current?.injectJavaScript(QQ_STOP_AUTH)
    }
  }, [connected])

  useEffect(() => {
    if (connected) return
    // 网页扫码可在 iframe 内异步完成，不一定触发顶层页面加载或 QQ App 回跳。
    const interval = setInterval(() => { if (AppState.currentState == 'active') onConnected() }, 2000)
    return () => { clearInterval(interval) }
  }, [connected, onConnected])

  useEffect(() => {
    if (authorization != 'pending') return
    const timeout = setTimeout(() => {
      awaitingQQ.current = false
      setAuthorization('expired')
      webview.current?.injectJavaScript(QQ_STOP_AUTH)
    }, 120_000)
    return () => { clearTimeout(timeout) }
  }, [authorization, onConnected])

  const openApp = (target: string) => {
    const wechatUrl = wechatLogin ? getWechatAppUrl(target, pageUrl.current) : null
    if (wechatUrl) {
      setLoading(false)
      if (Date.now() - lastLaunch.current < 1200) return
      lastLaunch.current = Date.now()
      void Linking.openURL(wechatUrl).catch(() => { if (active.current) setWechatNotice('无法打开微信，请使用下面的扫码方式。') })
      return
    }
    const appUrl = getLoginAppUrl(target, provider)
    if (!appUrl) return
    if (supportsQQ && /^wtloginmqq:/i.test(appUrl) && !/[?&]qrcode=/.test(appUrl)) {
      // 两个平台共用 QQ 官方二维码会话，避免 QQ 确认后跳到浏览器而丢失网易登录态。
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
    invalidateWechatQR()
    clearTimeout(qrTimer.current)
    exportingQR.current = false
    setWechatBusy(false)
    setWechatNotice('')
    pageUrl.current = initialUrl
    awaitingQQ.current = false
    lastLaunch.current = 0
    setFailed(false)
    setAppError(false)
    setAuthorization('idle')
    setUrl(initialUrl)
    setReloadKey(key => key + 1)
  }

  return <View style={styles.loginPage}>
    {wechatLogin ? <View style={[styles.wechatActions, { backgroundColor: theme['q-surface-raised'] }]}>
      <Button disabled={wechatBusy || loading || failed} style={[styles.wechatButton, { backgroundColor: theme['q-surface-tint'] }]} onPress={() => { void exportWechatQR().catch(() => { setWechatBusy(false) }) }}>
        {wechatBusy ? <ActivityIndicator size="small" color={theme['q-accent']} /> : null}
        <Text size={13} color={theme['q-accent-text']}>{wechatBusy ? '正在准备二维码…' : '保存二维码，在另一台设备展示'}</Text>
      </Button>
      <Text accessibilityLiveRegion="polite" size={11} color={theme['q-text-secondary']} style={styles.wechatTip}>{wechatNotice || '请用微信摄像头扫描另一块屏幕上的本页二维码，不要在微信相册内识别。确认后返回 Q-music，本页会继续接收登录结果。'}</Text>
    </View> : null}
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
            const target = awaitingQQ.current && provider == 'wy' ? getQQCallbackUrl(request.url, provider) : null
            if (target) { setUrl(target); setFailed(false); setAppError(false) } else if (supportsQQ) webview.current?.injectJavaScript(QQ_RESUME_AUTH)
            refreshConnection()
            return false
          }
          const normalized = normalizeLoginNavigation(request.url, provider)
          if (normalized != request.url) { setUrl(normalized); setFailed(false); return false }
          if (/^https?:/i.test(request.url) || request.url == 'about:blank') return true
          openApp(request.url)
          return false
        }}
        onOpenWindow={event => {
          const target = event.nativeEvent.targetUrl
          // 授权和 Cookie 留在同一个 WebView 中，避免跳到外部浏览器丢失登录态。
          if (/^https?:\/\//i.test(target)) setUrl(normalizeLoginNavigation(target, provider))
          else openApp(target)
        }}
        setSupportMultipleWindows
        onMessage={event => {
          if (wechatLogin && exportingQR.current && isWechatLoginPage(event.nativeEvent.url)) {
            try {
              const message = JSON.parse(event.nativeEvent.data) as { type?: string, image?: string, requestId?: number }
              if (message.requestId != qrRevision.current) return
              if (message.type == 'wechat-qr-image' || message.type == 'wechat-qr-unavailable') {
                exportingQR.current = false
                clearTimeout(qrTimer.current)
                if (typeof message.image == 'string' && message.image.length <= 600_000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(message.image)) void saveWechatQR(message.image)
                else { setWechatBusy(false); setWechatNotice('二维码尚未就绪，请刷新后重试。') }
                return
              }
            } catch {}
          }
          if (onDailyKey && isQQDailyOrigin(event.nativeEvent.url)) {
            try {
              const message = JSON.parse(event.nativeEvent.data) as { type?: string, key?: string }
              if (message.type == 'qq-daily-key' && typeof message.key == 'string' && /^qmk-[A-Za-z0-9_-]{12,1024}$/.test(message.key)) onDailyKey(message.key)
            } catch {}
            return
          }
          if (!supportsQQ || !isQQLoginPage(event.nativeEvent.url)) return
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
        onNavigationStateChange={state => { pageUrl.current = state.url }}
        onLoadEnd={() => {
          if (supportsQQ) webview.current?.injectJavaScript(QQ_AUTH_BRIDGE)
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

export default LoginPage

const styles = StyleSheet.create({
  wechatActions: { marginHorizontal: 12, marginBottom: 10, padding: 12, borderRadius: 16, gap: 8 },
  wechatButton: { minHeight: 44, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  wechatTip: { lineHeight: 17 },
  loginPage: { flex: 1 },
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
