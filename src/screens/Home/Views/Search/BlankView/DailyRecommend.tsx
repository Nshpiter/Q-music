import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { getAccountDaily, getDailyProvider, setDailyProvider, type DailyRecommendation } from '@/core/musicAccount/daily'
import type { MusicAccountProvider } from '@/core/musicAccount'
import { useNavigationComponentDidAppear } from '@/navigation'
import { pushMusicAccountScreen, pushPlayDetailScreen } from '@/navigation/navigation'
import commonState from '@/store/common/state'
import DailySettings from './DailySettings'
import { setTempList } from '@/core/list'
import { playList, togglePlay } from '@/core/player/player'
import { useIsPlay, usePlayMusicInfo } from '@/store/player/hook'
import PlayerBar from '@/components/player/PlayerBar'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { Q_TOUCH_HIT_SLOP, Q_UI } from '@/theme/ui'
import { createStyle, toast } from '@/utils/tools'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, FlatList, InteractionManager, Modal, SafeAreaView, ScrollView, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import DailyArtwork from './DailyArtwork'
import Skeleton from '@/components/common/Skeleton'

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const isPlay = useIsPlay()
  const playMusicInfo = usePlayMusicInfo()
  const sourceRef = useRef<MusicAccountProvider>('tx')
  const ready = useRef(false)
  const requestIdRef = useRef(0)
  const request = useRef<AbortController>()
  const pendingSource = useRef<MusicAccountProvider>()
  const shownSource = useRef<MusicAccountProvider>()
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
    if (!force && pendingSource.current == source && request.current && !request.current.signal.aborted) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    pendingSource.current = source
    const requestId = ++requestIdRef.current
    setLoading(true)
    setLoadError(false)
    if (shownSource.current != source) { setResult(undefined); setList([]) }
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const next = await Promise.race([
        getAccountDaily(source, force, controller.signal),
        new Promise<never>((resolve, reject) => {
          timeout = setTimeout(() => { controller.abort(); reject(new Error('timeout')) }, 45000)
        }),
      ])
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      shownSource.current = source
      setList(next.list)
      setResult(next)
    } catch {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      if (shownSource.current != source) setLoadError(true)
    } finally {
      if (timeout) clearTimeout(timeout)
      if (requestId == requestIdRef.current) {
        request.current = undefined
        pendingSource.current = undefined
        if (!isUnmountedRef.current) setLoading(false)
      }
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
  const sourceLabel = t(loading && !result ? 'search_daily_recommend_loading' : loadError ? 'load_failed' : result?.kind == 'official_daily' ? 'daily_official_daily' : result?.kind == 'radar' ? 'daily_radar' : result?.kind == 'netease_daily' ? 'daily_netease_daily' : 'daily_local')
  const playingDaily = list.some(item => item.id == playMusicInfo.musicInfo?.id)

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
  const openPlayDetail = useCallback(() => {
    setDetailVisible(false)
    void InteractionManager.runAfterInteractions(() => {
      if (commonState.componentIds.home) pushPlayDetailScreen(commonState.componentIds.home)
    })
  }, [])

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
        <Button accessibilityLabel={t('search_daily_recommend_play')} disabled={!list.length || startingPlayback} style={{ ...styles.action, backgroundColor: theme['q-accent'] }} onPress={() => { void handlePlay() }}>
          <Icon accessible={false} name="play" rawSize={14} color={theme['q-on-accent']} />
          <Text size={12} color={theme['q-on-accent']}>{t('search_daily_recommend_play')}</Text>
        </Button>
      </View>
      {loading && !list.length
        ? (
            <View accessible accessibilityLabel={t('search_daily_recommend_loading')} style={styles.skeleton}>
              <Skeleton width={96} height={16} radius={8} style={styles.discoveryTitle} />
              <View style={styles.rail}>
                {[0, 1, 2].map(index => (
                  <View key={index} style={styles.discoveryItem}>
                    <Skeleton height={120} radius={12} />
                    <Skeleton width="78%" height={12} style={styles.skeletonTitle} />
                    <Skeleton width="48%" height={10} />
                  </View>
                ))}
              </View>
            </View>
          )
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
            <Button disabled={!list.length || startingPlayback} style={styles.closeButton} accessibilityLabel={t(playingDaily && isPlay ? 'pause' : 'search_daily_recommend_play')} onPress={() => { if (playingDaily) togglePlay(); else void handlePlay() }}>
              <Icon name={playingDaily && isPlay ? 'pause' : 'play'} rawSize={22} color={theme['q-accent-text']} />
            </Button>
          </View>
          <FlatList
            data={list}
            refreshing={loading && list.length > 0}
            onRefresh={() => { if (!startingPlayback) void load(sourceRef.current, true) }}
            contentContainerStyle={styles.detailList}
            keyExtractor={item => `${item.source}_${item.id}`}
            ListEmptyComponent={loading
              ? (
                  <View accessible accessibilityLabel={t('search_daily_recommend_loading')}>
                    {[0, 1, 2, 3, 4, 5].map(index => (
                      <View key={index} style={[styles.item, { opacity: 1 - index * 0.12 }]}>
                        <Skeleton width={16} height={10} style={styles.trackNumberSkeleton} />
                        <Skeleton width={48} height={48} radius={12} />
                        <View style={styles.musicInfo}>
                          <Skeleton width={`${62 - (index % 3) * 10}%`} height={13} />
                          <Skeleton width="36%" height={10} style={styles.skeletonLine} />
                        </View>
                      </View>
                    ))}
                  </View>
                )
              : (
                  <View style={styles.detailState}>
                    <Text size={13} color={theme['q-text-secondary']}>{t(loadError ? 'load_failed' : 'search_daily_recommend_empty')}</Text>
                    {loadError
                      ? (
                          <Button accessibilityLabel={t('list_retry')} hitSlop={Q_TOUCH_HIT_SLOP} style={{ ...styles.errorAction, backgroundColor: theme['q-surface-tint'] }} onPress={() => { void load(sourceRef.current, true) }}>
                            <Icon accessible={false} name="available_updates" color={theme['q-accent-text']} rawSize={14} />
                            <Text size={12} color={theme['q-accent-text']}>{t('list_retry')}</Text>
                          </Button>
                        )
                      : null}
                  </View>
                )}
            renderItem={({ item, index }) => (
              <Button disabled={startingPlayback} accessibilityLabel={`${t(playMusicInfo.musicInfo?.id == item.id && isPlay ? 'pause' : 'play')} · ${item.name} · ${item.singer}`} style={styles.item} onPress={() => { if (playMusicInfo.musicInfo?.id == item.id) togglePlay(); else void handlePlay(index) }}>
                <Text size={12} style={styles.trackNumber} color={theme['q-text-secondary']}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.rowCover}>{renderCover(item)}</View>
                <View style={styles.musicInfo}>
                  <Text numberOfLines={1} size={15} color={theme['q-text-primary']}>{item.name}</Text>
                  <Text numberOfLines={1} size={12} color={theme['q-text-secondary']}>{item.singer}</Text>
                </View>
                <Icon name={playMusicInfo.musicInfo?.id == item.id && isPlay ? 'pause' : 'play'} rawSize={16} color={theme['q-accent-text']} />
              </Button>
            )}
          />
          <PlayerBar onOpenDetail={openPlayDetail} />
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
  rail: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  skeleton: { overflow: 'hidden' },
  skeletonTitle: { marginTop: 10, marginBottom: 6 },
  skeletonLine: { marginTop: 8 },
  trackNumberSkeleton: { marginRight: 12 },
  detailState: { minHeight: 240, gap: 12, alignItems: 'center', justifyContent: 'center' },
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
