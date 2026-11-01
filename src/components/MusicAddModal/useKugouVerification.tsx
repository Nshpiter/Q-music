import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, SafeAreaView, View } from 'react-native'
import WebView from 'react-native-webview'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createKugouCaptchaHtml, parseKugouCaptchaMessage } from '@/utils/kugouVerification'
import type { KugouCaptchaAnswer, KugouCaptchaPresenter } from '@/core/musicAccount/kugouApi'

export const useKugouVerification = () => {
  const theme = useTheme()
  const [html, setHtml] = useState('')
  const pending = useRef<{ resolve: (answer: KugouCaptchaAnswer) => void, reject: (error: Error) => void, timer: ReturnType<typeof setTimeout> }>()
  const finish = useCallback((answer?: KugouCaptchaAnswer, reason = 'verification_cancelled') => {
    const task = pending.current
    if (!task) return
    pending.current = undefined
    clearTimeout(task.timer)
    setHtml('')
    if (answer) task.resolve(answer)
    else task.reject(new Error(reason))
  }, [])
  useEffect(() => () => {
    const task = pending.current
    pending.current = undefined
    if (task) { clearTimeout(task.timer); task.reject(new Error('verification_cancelled')) }
  }, [])
  const present: KugouCaptchaPresenter = useCallback(async(appId) => {
    if (pending.current) throw new Error('verification_failed')
    const page = createKugouCaptchaHtml(appId)
    return new Promise<KugouCaptchaAnswer>((resolve, reject) => {
      pending.current = { resolve, reject, timer: setTimeout(() => { finish(undefined, 'verification_expired') }, 5 * 60_000) }
      setHtml(page)
    })
  }, [finish])
  const dialog = html ? <Modal visible animationType="slide" onRequestClose={() => { finish() }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme['c-content-background'] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 56 }}>
        <Text size={16} style={{ fontWeight: '600' }}>酷狗安全验证</Text>
        <Button accessibilityLabel="关闭安全验证" onPress={() => { finish() }} style={{ borderRadius: 12, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', backgroundColor: theme['q-surface-tint'] }}><Text size={14}>关闭</Text></Button>
      </View>
      <WebView source={{ html }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} mixedContentMode="never" allowFileAccess={false} setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={request => request.url == 'about:blank' || request.url.startsWith('data:text/html') || /^https:\/\/(?:[a-z0-9-]+\.)*(?:qq\.com|qcloud\.com|gtimg\.com)(?:\/|$)/i.test(request.url)}
        onMessage={event => { const answer = parseKugouCaptchaMessage(event.nativeEvent.data); if (answer) finish(answer) }}
        onError={() => { finish(undefined, 'verification_failed') }}
      />
    </SafeAreaView>
  </Modal> : null
  return { present, dialog }
}
