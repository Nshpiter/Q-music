import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, AppState, Keyboard, Linking, NativeModules, PermissionsAndroid, ScrollView, StyleSheet, View } from 'react-native'
import WebView from 'react-native-webview'
import BottomSheet from './common/BottomSheet'
import Button from './common/Button'
import Text from './common/Text'
import { Icon } from './common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n, type Message } from '@/lang'
import { useMotion } from '@/utils/useMotion'
import { httpFetch } from '@/utils/request'
import { pause } from '@/core/player/player'
import { requestSearch } from '@/core/search/navigation'
import { RecognitionSession, parseKugouRecognitionResults, parseRecognitionResults, recognitionUrl, type RecognitionSample, type RecognitionSong } from '@/utils/musicRecognition'

type Stage = 'idle' | 'permission' | 'recording' | 'matching' | 'result' | 'error'
const native = NativeModules.MusicRecognitionModule as {
  record: () => Promise<RecognitionSample>
  match: (pcm: string) => Promise<string>
  cancel: () => void
}
const errors = new Set(['recognition_permission', 'recognition_record_error', 'recognition_file_error', 'recognition_engine_error', 'recognition_service_error', 'recognition_silent', 'recognition_timeout', 'recognition_network_error', 'recognition_busy', 'recognition_interrupted'])

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const motion = useMotion()
  const [visible, setVisible] = useState(false)
  const [engineKey, setEngineKey] = useState(0)
  const engineVersion = useRef(0)
  const openRef = useRef(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [message, setMessage] = useState<keyof Message>('recognition_intro')
  const [remaining, setRemaining] = useState(10)
  const [songs, setSongs] = useState<RecognitionSong[]>([])
  const engine = useRef<WebView<{}>>(null)
  const session = useRef(new RecognitionSession()).current
  const busy = useRef(false)
  const stageRef = useRef(stage)
  stageRef.current = stage
  const readyRef = useRef(false)
  const duration = useRef(6)
  const cancelRequest = useRef<(() => void) | null>(null)
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulse = useRef(new Animated.Value(0)).current

  const cancel = useCallback(() => {
    session.cancel()
    busy.current = false
    native?.cancel()
    cancelRequest.current?.()
    cancelRequest.current = null
    if (deadline.current) clearTimeout(deadline.current)
    deadline.current = null
  }, [session])
  const close = useCallback(() => {
    openRef.current = false
    cancel()
    readyRef.current = false
    setVisible(false)
  }, [cancel])
  const fail = useCallback((id: number, code: string) => {
    if (!session.current(id)) return
    cancel()
    setMessage(code == 'recognition_cancelled' ? 'recognition_interrupted' : errors.has(code) ? code as keyof Message : 'recognition_network_error')
    setStage('error')
  }, [cancel, session])

  useEffect(() => () => { cancel() }, [cancel])
  useEffect(() => {
    if (!visible) return
    const listener = AppState.addEventListener('change', state => {
      if (state != 'active' && busy.current && stageRef.current != 'permission') {
        cancel(); setStage('error'); setMessage('recognition_interrupted')
      }
    })
    return () => { listener.remove() }
  }, [visible, engineKey, cancel])
  useEffect(() => {
    if (stage != 'recording') { pulse.setValue(0); return }
    const start = Date.now()
    setRemaining(10)
    const timer = setInterval(() => { setRemaining(Math.max(0, 10 - Math.floor((Date.now() - start) / 1000))) }, 200)
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]))
    if (motion) animation.start()
    return () => { clearInterval(timer); animation.stop() }
  }, [stage, motion, pulse])

  const start = async() => {
    if (busy.current || !native) return
    const id = session.begin()
    busy.current = true
    setSongs([]); setMessage('recognition_intro')
    try {
      setStage('permission')
      const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
      if (!session.current(id)) return
      if (permission != PermissionsAndroid.RESULTS.GRANTED) { fail(id, 'recognition_permission'); return }
      if (!session.current(id) || AppState.currentState != 'active') { fail(id, 'recognition_interrupted'); return }
      // 避免把 Q-music 自己的播放声当作待识别歌曲；结束后由用户决定是否继续播放。
      await pause()
      if (!session.current(id)) return
      stageRef.current = 'recording'
      setStage(stageRef.current)
      const sample = await native.record()
      if (!session.current(id)) return
      if (!sample) { busy.current = false; setStage('idle'); return }
      if (!Number.isFinite(sample.rms) || sample.rms < 0.001) { fail(id, 'recognition_silent'); return }
      setStage('matching'); stageRef.current = 'matching'
      deadline.current = setTimeout(() => { fail(id, 'recognition_timeout') }, 30000)
      let primaryFailed = false
      try {
        const result = parseKugouRecognitionResults(JSON.parse(await native.match(sample.pcm)))
        if (!session.current(id)) return
        if (result.length) { complete(result); return }
      } catch {
        if (!session.current(id)) return
        primaryFailed = true
      }
      // 酷狗无结果或暂不可用时，复用同一段录音的前 6 秒生成网易云指纹，不再次录音。
      if (!readyRef.current) {
        if (primaryFailed) fail(id, 'recognition_service_error')
        else complete([])
        return
      }
      duration.current = Math.min(6, sample.duration)
      engine.current?.injectJavaScript(`window.fingerprint(${JSON.stringify({ id, pcm: sample.pcm.slice(0, 128000) })});true;`)
    } catch (error: any) { fail(id, typeof error?.code == 'string' ? String(error.code) : 'recognition_record_error') }
  }

  const complete = (result: RecognitionSong[]) => {
    if (deadline.current) clearTimeout(deadline.current)
    deadline.current = null; cancelRequest.current = null; busy.current = false
    setSongs(result); setStage('result')
  }

  const onMessage = async(text: string, version: number) => {
    if (!openRef.current || version != engineVersion.current || text.length > 20000) return
    let data: Record<string, unknown>
    try { data = JSON.parse(text) } catch { return }
    if (!data || typeof data != 'object') return
    if (data.type == 'ready') { readyRef.current = true; return }
    if (data.type == 'error' && data.id == null) { readyRef.current = false; return }
    if (typeof data.id != 'number' || !Number.isInteger(data.id) || !session.current(data.id) || !busy.current) return
    if (data.type == 'error') { fail(data.id, 'recognition_engine_error'); return }
    if (data.type != 'fingerprint' || typeof data.value != 'string' || cancelRequest.current) return
    try {
      const url = recognitionUrl(data.value, duration.current, `${Date.now().toString(16)}${data.id.toString(16)}`)
      // 整轮有统一截止，关闭面板会取消备用请求。
      const request = httpFetch(url, { timeout: 25000, headers: { Referer: 'https://music.163.com/' } })
      cancelRequest.current = () => { request.cancelHttp() }
      const response = await request.promise
      if (!session.current(data.id)) return
      if (response.statusCode != 200) { fail(data.id, 'recognition_service_error'); return }
      const result = parseRecognitionResults(typeof response.body == 'string' ? JSON.parse(response.body) : response.body)
      complete(result)
    } catch (error: any) { fail(data.id, error?.message == 'recognition_service_error' ? 'recognition_service_error' : 'recognition_network_error') }
  }

  const working = stage == 'permission' || stage == 'recording' || stage == 'matching'
  const status = stage == 'error' ? message : stage == 'result' ? songs.length ? 'recognition_found' : 'recognition_no_match' : stage == 'recording' ? 'recognition_listening' : stage == 'matching' ? 'recognition_matching' : stage == 'permission' ? 'recognition_permission_wait' : 'recognition_intro'
  return <>
    <Button accessibilityLabel={t('recognition_title')} style={styles.entry} onPress={() => {
      Keyboard.dismiss(); setStage('idle'); setMessage('recognition_intro'); setSongs([]); readyRef.current = false; openRef.current = true; setEngineKey(++engineVersion.current); setVisible(true)
    }}><Icon name="mic" rawSize={21} color={theme['q-accent-text']} /></Button>
    <BottomSheet visible={visible} onClose={close} maxHeight={songs.length ? 620 : 410} testID="music-recognition-sheet">
      <View style={styles.header}>
        <Text size={19} style={styles.title}>{t('recognition_title')}</Text>
        <Button accessibilityLabel={t('close')} onPress={close} style={styles.entry}><Icon name="close" rawSize={22} color={theme['q-text-secondary']} /></Button>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Button accessibilityState={{ busy: working }} accessibilityLabel={t('recognition_start')} onPress={working ? undefined : () => { void start() }} ripple={working ? null : undefined} style={[styles.symbol, { backgroundColor: theme['q-surface-tint'] }]}>
          {stage == 'matching' ? <ActivityIndicator size="large" color={theme['q-accent-text']} /> : <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] }}><Icon name="mic" rawSize={36} color={theme['q-accent-text']} /></Animated.View>}
        </Button>
        <Text accessibilityLiveRegion="polite" size={16} style={styles.status}>{t(status)}{stage == 'recording' ? ` ${remaining}s` : ''}</Text>
        <Text size={12} color={theme['q-text-secondary']} style={styles.description}>{t('recognition_privacy')}</Text>
        {songs.map(song => <Button key={song.id} accessibilityLabel={`${t('recognition_search')} · ${song.name} · ${song.singer}`} style={[styles.result, { backgroundColor: theme['q-surface-tint'] }]} onPress={() => {
          close(); requestSearch({ source: song.source ?? 'wy', keyword: `${song.name} ${song.singer}`.trim() })
        }}>
          <View style={styles.song}><Text size={15} numberOfLines={2}>{song.name}</Text><Text size={12} color={theme['q-text-secondary']} numberOfLines={2}>{[song.singer, song.album].filter(Boolean).join(' · ')}</Text></View>
          <Text size={12} color={theme['q-accent-text']}>{t('recognition_search')}</Text>
          <Icon name="chevron-right" rawSize={16} color={theme['q-accent-text']} />
        </Button>)}
        {working ? <Button style={[styles.action, { backgroundColor: theme['q-surface-tint'] }]} onPress={() => { cancel(); setStage('idle') }}><Text>{t('cancel')}</Text></Button> : <>
          {stage == 'error' && message == 'recognition_permission' ? <Button style={styles.action} onPress={() => { void Linking.openSettings().catch(() => {}) }}><Text color={theme['q-accent-text']}>{t('recognition_open_settings')}</Text></Button> : null}
          <Button style={[styles.action, { backgroundColor: theme['q-surface-tint'] }]} onPress={() => { void start() }}><Text color={theme['q-accent-text']}>{t('recognition_start')}</Text></Button>
        </>}
      </ScrollView>
      {visible ? <View style={styles.engine} pointerEvents="none" importantForAccessibility="no-hide-descendants"><WebView<{}> key={engineKey} ref={engine} source={{ uri: 'file:///android_asset/recognition/index.html' }}
        originWhitelist={['file://*']} javaScriptEnabled allowFileAccess allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        domStorageEnabled={false} mixedContentMode="never" setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={request => request.url == 'file:///android_asset/recognition/index.html'}
        onMessage={event => { void onMessage(String(event.nativeEvent.data), engineKey) }} onError={() => { if (!openRef.current || engineKey != engineVersion.current) return; readyRef.current = false }}
      /></View> : null}
    </BottomSheet>
  </>
}

const styles = StyleSheet.create({
  entry: { width: 44, height: 48, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  title: { flex: 1, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  symbol: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 14, marginBottom: 18 },
  status: { textAlign: 'center', lineHeight: 24 },
  description: { textAlign: 'center', marginTop: 10, marginBottom: 20, lineHeight: 19 },
  action: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8, padding: 10 },
  result: { minHeight: 70, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  song: { flex: 1, gap: 6 },
  engine: { position: 'absolute', width: 1, height: 1, opacity: 0 },
})
