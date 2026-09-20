import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { getAccountDaily, getDailyProvider, setDailyProvider, type DailyRecommendation } from '@/core/musicAccount/daily'
import type { MusicAccountProvider } from '@/core/musicAccount'
import { useNavigationComponentDidAppear } from '@/navigation'
import { pushMusicAccountScreen } from '@/navigation/navigation'
import commonState from '@/store/common/state'
import DailySettings from './DailySettings'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { Q_TOUCH_HIT_SLOP, Q_UI } from '@/theme/ui'
import { createStyle, toast } from '@/utils/tools'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, FlatList, Modal, SafeAreaView, ScrollView, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import DailyArtwork from './DailyArtwork'

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const sourceRef = useRef<MusicAccountProvider>('tx')
  const ready = useRef(false)
  const requestIdRef = useRef(0)
  const request = useRef<AbortController>()
  const isUnmountedRef = useRef(false)
  const [provider, setProvider] = useState<MusicAccountProvider>('tx')
  const [result, setResult] = useState<DailyRecommendation>()
  const [list, setList] = useState<LX.Music.MusicInfoOnline[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [startingPlayback, setStartingPlayback] = useState(false)
  const playbackPending = useRef(false)

  const load = useCallback(async(source: MusicAccountProvider, force = false) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const requestId = ++requestIdRef.current
    setLoading(true)
    setLoadError(false)
    setResult(undefined)
    setList([])
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const next = await Promise.race([
        getAccountDaily(source, force, controller.signal),
        new Promise<never>((resolve, reject) => {
          timeout = setTimeout(() => { controller.abort(); reject(new Error('timeout')) }, 45000)
        }),
      ])
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      setList(next.list)
      setResult(next)
    } catch {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      setLoadError(true)
    } finally {
      if (timeout) clearTimeout(timeout)
      if (!isUnmountedRef.current && requestId == requestIdRef.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    isUnmountedRef.current = false
    void getDailyProvider().then(source => {
      if (isUnmountedRef.current) return
      sourceRef.current = source
      setProvider(source)
      ready.current = true
      void load(source)
    })
    const listener = AppState.addEventListener('change', state => {
      if (state == 'active' && ready.current && commonState.navActiveId == 'nav_search') void load(sourceRef.current)
    })
    return () => { isUnmountedRef.current = true; ready.current = false; request.current?.abort(); listener.remove() }
  }, [load])
  const resume = useCallback(() => {
    if (ready.current && commonState.navActiveId == 'nav_search') void load(sourceRef.current)
  }, [load])
  useNavigationComponentDidAppear(commonState.componentIds.home ?? '', resume)

  const changeProvider = (source: MusicAccountProvider) => {
    if (!ready.current || source == sourceRef.current || playbackPending.current) return
    sourceRef.current = source
    setProvider(source)
    void setDailyProvider(source).catch(() => { toast(t('daily_preference_failed')) })
    void load(source)
  }
  const refresh = useCallback(() => { void load(sourceRef.current, true) }, [load])
  const openAccount = () => {
    setSettingsVisible(false)
    if (commonState.componentIds.home) pushMusicAccountScreen(commonState.componentIds.home, sourceRef.current)
  }
  const sourceLabel = t(loading ? 'search_daily_recommend_loading' : loadError ? 'load_failed' : result?.kind == 'official_daily' ? 'daily_official_daily' : result?.kind == 'radar' ? 'daily_radar' : result?.kind == 'netease_daily' ? 'daily_netease_daily' : 'daily_local')

  const handlePlay = useCallback(async(index = 0) => {
    if (!list.length || playbackPending.current) return
    playbackPending.current = true
    setStartingPlayback(true)
    try {
      const date = new Date()
      await setTempList(`q_daily_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`, list)
      await playList(LIST_IDS.TEMP, index)
    } catch {
      toast(t('load_failed'))
    } finally {
      playbackPending.current = false
      if (!isUnmountedRef.current) setStartingPlayback(false)
    }
  }, [list, t])

  const renderCover = (item?: LX.Music.MusicInfoOnline) => <DailyArtwork item={item} />

  return (
    <View
      style={{
        ...styles.container,
        backgroundColor: theme['q-surface-raised'],
        borderColor: theme['q-outline'],
      }}
    >
      <View style={styles.providerBar}>
        {(['tx', 'wy'] as const).map(source => <Button key={source} ripple={null} disabled={startingPlayback} accessibilityRole="tab" accessibilityState={{ selected: provider == source }} onPress={() => { changeProvider(source) }} style={[styles.providerChip, { backgroundColor: provider == source ? theme['q-surface-tint'] : 'transparent' }]}><Text size={12} color={provider == source ? theme['q-accent-text'] : theme['q-text-secondary']}>{t(source == 'tx' ? 'setting_music_account_qq' : 'setting_music_account_netease')}</Text></Button>)}
        <Button accessibilityLabel={t('daily_settings')} style={styles.settingsButton} onPress={() => { setSettingsVisible(true) }}><Icon name="slider" rawSize={19} color={theme['q-text-secondary']} /></Button>
      </View>
      <Button accessibilityLabel={t('search_daily_open')} style={styles.feature} onPress={() => { setDetailVisible(true) }}>
        <View style={styles.mosaic}>
          {[0, 1, 2, 3].map(index => <View key={index} style={styles.tile}>{renderCover(list[index])}</View>)}
          <View style={{ ...styles.dateBadge, backgroundColor: theme['q-surface-raised'] }}>
            <Text size={24} style={styles.title} color={theme['q-accent-text']}>{new Date().getDate().toString().padStart(2, '0')}</Text>
          </View>
        </View>
        <View style={styles.titleContent}>
          <Text size={10} style={styles.eyebrow} color={theme['q-accent-text']}>DAILY MIX</Text>
          <Text size={23} style={styles.title} color={theme['q-text-primary']}>{t('search_daily_recommend')}</Text>
          <Text size={12} style={styles.subtitle} color={theme['q-text-secondary']}>{sourceLabel}</Text>
          <Text size={12} style={styles.openHint} color={theme['q-accent-text']}>{t('search_daily_open')} ›</Text>
        </View>
      </Button>
      {result?.reason ? <Button onPress={result.reason == 'login_required' ? openAccount : () => { setSettingsVisible(true) }} style={styles.sourceNotice}><Text size={11} color={theme['q-text-secondary']}>{t(result.reason == 'login_required' ? 'daily_fallback_login' : result.reason == 'official_unavailable' && result.kind == 'radar' ? 'daily_radar_fallback' : 'daily_fallback_unavailable')} ›</Text></Button> : null}
      <View style={styles.actions}>
        <Button accessibilityLabel={t('daily_refresh')} disabled={loading || startingPlayback} style={{ ...styles.action, backgroundColor: theme['q-surface-tint'] }} onPress={() => { void load(sourceRef.current, true) }}>
          <Text size={12} color={theme['q-accent-text']}>{t('daily_refresh')}</Text>
        </Button>
        <Button accessibilityLabel={t('search_daily_recommend_play')} disabled={loading || !list.length || startingPlayback} style={{ ...styles.action, backgroundColor: theme['q-accent'] }} onPress={() => { void handlePlay() }}>
          <Icon accessible={false} name="play" rawSize={14} color={theme['q-on-accent']} />
          <Text size={12} color={theme['q-on-accent']}>{t('search_daily_recommend_play')}</Text>
        </Button>
      </View>
      {loading
        ? <View style={styles.state}><ActivityIndicator color={theme['q-accent']} /><Text size={12} color={theme['q-text-secondary']}>{t('search_daily_recommend_loading')}</Text></View>
        : loadError
          ? (
              <View style={styles.state}>
                <Text size={12} color={theme['q-text-secondary']}>{t('load_failed')}</Text>
                <Button accessibilityLabel={t('list_retry')} hitSlop={Q_TOUCH_HIT_SLOP} style={{ ...styles.errorAction, backgroundColor: theme['q-surface-tint'] }} onPress={() => { void load(sourceRef.current, true) }}>
                  <Icon accessible={false} name="available_updates" color={theme['q-accent-text']} rawSize={14} />
                  <Text size={12} color={theme['q-accent-text']}>{t('list_retry')}</Text>
                </Button>
              </View>
            )
          : list.length
            ? <>
                <Text size={17} style={styles.discoveryTitle} color={theme['q-text-primary']}>{t('search_today_discovery')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {list.slice(0, 9).map((item, index) => (
                    <Button key={`${item.source}_${item.id}`} disabled={startingPlayback} accessibilityLabel={`${t('play')} · ${item.name} · ${item.singer}`} style={styles.discoveryItem} onPress={() => { void handlePlay(index) }}>
                      {renderCover(item)}
                      <Text numberOfLines={1} size={13} style={styles.trackTitle} color={theme['q-text-primary']}>{item.name}</Text>
                      <Text numberOfLines={1} size={11} color={theme['q-text-secondary']}>{item.singer}</Text>
                    </Button>
                  ))}
                </ScrollView>
              </>
            : <View style={styles.state}><Text size={12} color={theme['q-text-secondary']}>{t('search_daily_recommend_empty')}</Text></View>}
      {settingsVisible ? <DailySettings provider={provider} onClose={() => { setSettingsVisible(false) }} onChanged={refresh} onLogin={openAccount} /> : null}
      <Modal visible={detailVisible} animationType="slide" onRequestClose={() => { setDetailVisible(false) }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme['c-content-background'] }}>
          <View style={styles.detailHeader}>
            <Button accessibilityLabel={t('back')} style={styles.closeButton} onPress={() => { setDetailVisible(false) }}>
              <Text size={28} color={theme['q-text-primary']}>‹</Text>
            </Button>
            <View style={styles.titleContent}><Text size={20} color={theme['q-text-primary']}>{t('search_daily_recommend')}</Text><Text size={11} color={theme['q-text-secondary']}>{sourceLabel}</Text></View>
            <Button disabled={!list.length || startingPlayback} style={styles.closeButton} accessibilityLabel={t('search_daily_recommend_play')} onPress={() => { void handlePlay() }}>
              <Icon name="play" rawSize={22} color={theme['q-accent-text']} />
            </Button>
          </View>
          <FlatList
            data={list}
            refreshing={loading}
            onRefresh={() => { if (!startingPlayback) void load(sourceRef.current, true) }}
            contentContainerStyle={styles.detailList}
            keyExtractor={item => `${item.source}_${item.id}`}
            ListEmptyComponent={<Text color={theme['q-text-secondary']}>{t(loading ? 'search_daily_recommend_loading' : loadError ? 'load_failed' : 'search_daily_recommend_empty')}</Text>}
            renderItem={({ item, index }) => (
              <Button disabled={startingPlayback} accessibilityLabel={`${t('play')} · ${item.name} · ${item.singer}`} style={styles.item} onPress={() => { void handlePlay(index) }}>
                <Text size={12} style={styles.trackNumber} color={theme['q-text-secondary']}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.rowCover}>{renderCover(item)}</View>
                <View style={styles.musicInfo}>
                  <Text numberOfLines={1} size={15} color={theme['q-text-primary']}>{item.name}</Text>
                  <Text numberOfLines={1} size={12} color={theme['q-text-secondary']}>{item.singer}</Text>
                </View>
                <Icon name="play" rawSize={16} color={theme['q-accent-text']} />
              </Button>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = createStyle({
  providerBar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  providerChip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center' },
  settingsButton: { marginLeft: 'auto', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sourceNotice: { paddingTop: 12, paddingBottom: 4, minHeight: 36, justifyContent: 'center' },
  container: {
    paddingTop: 18,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 16,
    borderWidth: 1,
    borderRadius: 20,
  },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  mosaic: { width: 112, height: 112, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 18, overflow: 'hidden' },
  tile: { width: '50%', height: '50%', padding: 1 },
  dateBadge: { position: 'absolute', bottom: 6, right: 6, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 2 },
  eyebrow: { letterSpacing: 2, fontWeight: '700', marginBottom: 6 },
  openHint: { marginTop: 10, fontWeight: '600' },
  discoveryTitle: { fontWeight: '700', marginTop: 24, marginBottom: 14 },
  rail: { gap: 12, paddingBottom: 4 },
  discoveryItem: { width: 120 },
  trackTitle: { fontWeight: '600', marginTop: 8, marginBottom: 3 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  closeButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  detailList: { paddingHorizontal: 20, paddingBottom: 24 },
  trackNumber: { width: 28 },
  rowCover: { width: 48, height: 48 },
  titleContent: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 17,
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: Q_UI.touchSize,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  item: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
  },
  musicInfo: {
    flex: 1,
    paddingLeft: 11,
    gap: 2,
  },
  state: {
    minHeight: 82,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorAction: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
})
