import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, FlatList, Keyboard, StyleSheet, View } from 'react-native'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import Input from '@/components/common/Input'
import { Icon } from '@/components/common/Icon'
import TrackArtwork from '@/components/TrackArtwork'
import SourceLogo from '@/components/SourceLogo'
import PlayerBar from '@/components/player/PlayerBar'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import SongMenuSheet, { type SongMenuActionItem } from '@/components/SongMenuSheet'
import { ActivePlayingWave } from '@/components/player/PlayingWave'
import { playHistory } from '@/core/playHistory'
import { playFromPage, playAllFromPage } from '@/core/player/selection'
import { addTempPlayList } from '@/core/player/tempPlayList'
import { handleDislikeMusic, handleShare, handleShowMusicSourceDetail } from '@/components/OnlineList/listAction'
import { usePlayMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useMotion } from '@/utils/useMotion'
import { Q_UI } from '@/theme/ui'
import { pop } from '@/navigation'
import { toast } from '@/utils/tools'
import { filterTracks } from '@/utils/filterTracks'
import { buildAndroidSongMenus } from '@/utils/songMenu'

const formatPlayedTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay = date.getFullYear() == now.getFullYear() && date.getMonth() == now.getMonth() && date.getDate() == now.getDate()
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return sameDay ? time : `${date.toLocaleDateString([], { month: '2-digit', day: '2-digit' })} ${time}`
}

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const motion = useMotion()
  const statusBarHeight = useStatusbarHeight()
  const { musicInfo: currentMusic } = usePlayMusicInfo()
  const [entries, setEntries] = useState(playHistory.snapshot().entries)
  const [ranked, setRanked] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const closeSearch = () => {
    Keyboard.dismiss()
    setQuery(null)
  }
  const [segmentWidth, setSegmentWidth] = useState(0)
  const segmentProgress = useRef(new Animated.Value(0)).current
  const confirmRef = useRef<ConfirmAlertType>(null)
  const addRef = useRef<MusicAddModalType>(null)
  const [menuTrack, setMenuTrack] = useState<{ track: LX.Music.MusicInfo, index: number } | null>(null)
  const [menuVisible, setMenuVisible] = useState(false)
  const openMenu = (track: LX.Music.MusicInfo, index: number) => {
    setMenuTrack({ track, index })
    setMenuVisible(true)
  }
  const menuItems = useMemo(() => {
    if (!menuTrack) return []
    return buildAndroidSongMenus({
      t,
      control: {
        musicSourceDetail: menuTrack.track.source != 'local',
        dislike: true,
        remove: true,
      },
      includeDownload: false,
      includeMusicSourceDetail: menuTrack.track.source != 'local',
      includeRemove: true,
    })
  }, [menuTrack, t])
  const run = (action: Promise<void>) => { void action.catch(() => { toast(t('play_history_failed')) }) }

  useEffect(() => {
    const unsubscribe = playHistory.subscribe(() => { setEntries(playHistory.snapshot().entries) })
    run(playHistory.load())
    return unsubscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    segmentProgress.stopAnimation()
    if (motion) Animated.spring(segmentProgress, { toValue: ranked ? 1 : 0, ...Q_UI.motion.settle, overshootClamping: true, useNativeDriver: true }).start()
    else segmentProgress.setValue(ranked ? 1 : 0)
    return () => { segmentProgress.stopAnimation() }
  }, [motion, ranked, segmentProgress])

  const orderedRows = useMemo(() => {
    const list = ranked ? [...entries].sort((a, b) => b.playCount - a.playCount || b.playedAt - a.playedAt) : entries
    return list.map((entry, index) => ({ ...entry, rank: index + 1, key: `${entry.track.source}:${entry.track.id}` }))
  }, [entries, ranked])

  const rows = useMemo(() => filterTracks(orderedRows, query ?? '', row => row.track), [orderedRows, query])
  const listRef = useRef<FlatList<typeof rows[number]>>(null)
  const filtered = !!query?.trim()
  const maxPlayCount = orderedRows[0]?.playCount || 1
  const thumbWidth = Math.max(0, (segmentWidth - 6) / 2)

  return <PageContent>
    <StatusBar />
    <View style={[styles.headerSurface, { paddingTop: statusBarHeight, backgroundColor: theme['q-surface-raised'], borderBottomColor: theme['q-outline'] }]}>
      <View style={styles.header}>
        <IconButton
          accessibilityLabel={t('back')}
          name="chevron-left"
          iconSize={22}
          size={48}
          iconColor={theme['q-text-primary']}
          onPress={() => { if (query !== null) closeSearch(); else void pop(componentId) }}
        />
        {query !== null ? <>
          <Input autoFocus clearBtn value={query} onChangeText={text => {
            setQuery(text)
            listRef.current?.scrollToOffset({ offset: 0, animated: false })
          }} accessibilityLabel={t('track_search_hint')} placeholder={t('track_search_hint')} returnKeyType="search" containerStyle={styles.searchInput} />
          <View style={[styles.countBadge, styles.searchCountBadge, { backgroundColor: theme['q-surface-tint'] }]}>
            <Text size={11} style={styles.countBadgeText} color={theme['q-accent-text']}>{rows.length}</Text>
          </View>
        </> : <><View style={styles.titleWrap}>
          <Text size={20} style={styles.title} color={theme['q-text-primary']} numberOfLines={1}>{t('play_history_title')}</Text>
          {entries.length > 0 ? <View style={[styles.countBadge, { backgroundColor: theme['q-surface-tint'] }]}>
            <Text size={11} style={styles.countBadgeText} color={theme['q-accent-text']}>{entries.length}</Text>
          </View> : null}
        </View>
        {entries.length > 0 && <IconButton name="search-2" accessibilityLabel={t('track_search_hint')} size={44} iconSize={20} iconColor={theme['q-text-secondary']} onPress={() => { setQuery('') }} />}
        <Button disabled={!entries.length} onPress={() => confirmRef.current?.setVisible(true)} style={styles.clearBtn}>
          <Text size={13} color={entries.length ? theme['q-text-secondary'] : theme['c-font-label']}>{t('play_history_clear')}</Text>
        </Button></>}
      </View>
    </View>

    <View style={styles.contentWrap}>
      {entries.length > 0 ? <View style={styles.toolbar}>
        <View
          accessibilityRole="tablist"
          onLayout={event => { setSegmentWidth(event.nativeEvent.layout.width) }}
          style={[styles.segmented, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]}
        >
          {thumbWidth > 0 ? <Animated.View
            pointerEvents="none"
            style={[styles.segmentThumb, {
              width: thumbWidth,
              backgroundColor: theme['q-surface-tint'],
              borderColor: theme['q-outline'],
              transform: [{ translateX: segmentProgress.interpolate({ inputRange: [0, 1], outputRange: [3, 3 + thumbWidth] }) }],
            }]}
          /> : null}
          <Button
            accessibilityRole="tab"
            accessibilityState={{ selected: !ranked }}
            style={styles.segmentBtn}
            onPress={() => { setRanked(false) }}
          >
            <Text size={13} style={!ranked ? styles.segmentActiveText : undefined} color={!ranked ? theme['q-accent-text'] : theme['q-text-secondary']} numberOfLines={1}>{t('play_history_recent')}</Text>
          </Button>
          <Button
            accessibilityRole="tab"
            accessibilityState={{ selected: ranked }}
            style={styles.segmentBtn}
            onPress={() => { setRanked(true) }}
          >
            <Text size={13} style={ranked ? styles.segmentActiveText : undefined} color={ranked ? theme['q-accent-text'] : theme['q-text-secondary']} numberOfLines={1}>{t('play_history_rank')}</Text>
          </Button>
        </View>
        <Button
          disabled={!rows.length}
          style={[styles.playAll, { backgroundColor: theme['q-surface-tint'], borderColor: theme['q-outline'] }]}
          onPress={() => { run(playAllFromPage('play-history', rows.map(item => item.track))) }}
        >
          <Icon accessible={false} name="play-outline" size={16} color={theme['q-accent-text']} />
          <Text size={13} style={styles.playAllText} color={theme['q-accent-text']} numberOfLines={1}>{t(filtered ? 'play_history_play_results' : 'play_all')}</Text>
        </Button>
      </View> : null}

      <FlatList
        ref={listRef}
        data={rows}
        keyboardShouldPersistTaps="handled"
        key={ranked ? 'ranked' : 'recent'}
        keyExtractor={item => item.key}
        contentContainerStyle={[styles.listContent, !rows.length && styles.emptyContainer]}
        ListEmptyComponent={<View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme['q-surface-tint'], borderColor: theme['q-outline'] }]}>
            <Icon name={filtered && entries.length ? 'search-2' : 'music_time'} size={28} color={theme['q-accent-text']} />
          </View>
          <Text size={14} style={styles.emptyText} color={theme['q-text-secondary']}>{t(filtered && entries.length ? 'play_history_search_empty' : 'play_history_empty')}</Text>
        </View>}
        renderItem={({ item, index }) => {
          const playing = !!currentMusic && !('progress' in currentMusic) && currentMusic.id == item.track.id && currentMusic.source == item.track.source
          const onlineSource = item.track.source != 'local' ? item.track.source : null
          return <View style={[styles.row, { backgroundColor: playing ? theme['q-surface-tint'] : theme['q-surface-raised'], borderColor: playing ? theme['q-accent'] : theme['q-outline'] }]}>
            {playing ? <View pointerEvents="none" style={[styles.playingRail, { backgroundColor: theme['q-accent'] }]} /> : null}
            <Button
              style={styles.track}
              onPress={() => { run(playFromPage('play-history', rows.map(row => row.track), index)) }}
              onLongPress={() => { openMenu(item.track, index) }}
            >
              {ranked ? <Text size={13} style={[styles.rankNum, item.rank <= 3 && styles.rankTop]} color={item.rank <= 3 ? theme['q-accent-text'] : theme['q-text-secondary']}>{item.rank}</Text> : null}
              <View style={[styles.coverWrap, { backgroundColor: theme['q-surface-tint'] }]}>
                <TrackArtwork item={item.track} style={styles.cover} />
              </View>
              <View style={styles.trackMeta}>
                <View style={styles.titleLine}>
                  <Text size={14} style={[styles.trackTitle, playing && styles.playingTitle]} color={playing ? theme['q-accent-text'] : theme['q-text-primary']} numberOfLines={1}>{item.track.name}</Text>
                  {playing ? <ActivePlayingWave size={12} color={theme['q-accent-text']} style={styles.inlineWave} /> : null}
                </View>
                <View style={styles.subRow}>
                  {onlineSource ? <SourceLogo source={onlineSource} size={13} /> : null}
                  <Text size={12} style={styles.subText} color={theme['q-text-secondary']} numberOfLines={1}>
                    {item.track.singer} · {t(item.track.source == 'local' ? 'history_source_local' : `source_real_${item.track.source}`)}
                  </Text>
                </View>
              </View>
              {ranked
                ? <View style={styles.rankRight}>
                    <Text size={11} style={styles.countLabel} color={theme['q-text-secondary']}>{t('play_history_count', { count: item.playCount })}</Text>
                    <View style={[styles.meterTrack, { backgroundColor: theme['q-outline'] }]}>
                      <View style={[styles.meterFill, { width: `${Math.max(8, Math.round((item.playCount / maxPlayCount) * 100))}%`, backgroundColor: theme['q-accent'] }]} />
                    </View>
                  </View>
                : <Text size={11} style={styles.timeText} color={theme['q-text-secondary']}>{formatPlayedTime(item.playedAt)}</Text>}
            </Button>
            <IconButton
              name="dots-vertical"
              iconSize={18}
              size={40}
              iconColor={theme['q-text-secondary']}
              accessibilityLabel={`${item.track.name} · ${t('more_actions')}`}
              onPress={() => { openMenu(item.track, index) }}
            />
            <IconButton
              name="close"
              iconSize={18}
              size={40}
              iconColor={theme['q-text-secondary']}
              accessibilityLabel={t('play_history_remove', { name: item.track.name })}
              onPress={() => { run(playHistory.remove(item.track)) }}
            />
          </View>
        }}
      />
    </View>
    <PlayerBar />
    <MusicAddModal ref={addRef} />
    <SongMenuSheet
      visible={menuVisible}
      musicInfo={menuTrack?.track ?? null}
      menus={menuItems}
      onClose={() => { setMenuVisible(false) }}
      onClosed={() => { setMenuTrack(null) }}
      onSelect={(item: SongMenuActionItem) => {
        if (!menuTrack) return
        const { track, index } = menuTrack
        switch (item.action) {
          case 'play':
            run(playFromPage('play-history', rows.map(row => row.track), index))
            break
          case 'playNext':
            addTempPlayList([{ listId: '', musicInfo: track, isTop: true }])
            break
          case 'playLater':
            addTempPlayList([{ listId: '', musicInfo: track }])
            break
          case 'add':
            addRef.current?.show({ musicInfo: track, listId: '', isMove: false })
            break
          case 'copyName':
            handleShare(track as LX.Music.MusicInfoOnline)
            break
          case 'musicSourceDetail':
            if (track.source != 'local') void handleShowMusicSourceDetail(track)
            break
          case 'dislike':
            void handleDislikeMusic(track as LX.Music.MusicInfoOnline)
            break
          case 'remove':
            run(playHistory.remove(track))
            break
        }
      }}
    />
    <ConfirmAlert ref={confirmRef} text={t('play_history_clear_confirm')} onConfirm={() => { confirmRef.current?.setVisible(false); run(playHistory.clear()) }} />
  </PageContent>
}

const styles = StyleSheet.create({
  headerSurface: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    minHeight: 56,
    gap: 4,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
  },
  searchCountBadge: {
    marginLeft: 6,
    marginRight: 4,
  },
  countBadgeText: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  clearBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    flex: 1,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  segmented: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: Q_UI.radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentThumb: {
    position: 'absolute',
    left: 0,
    top: 3,
    bottom: 3,
    borderRadius: Q_UI.radius.control - 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: Q_UI.radius.control - 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentActiveText: {
    fontWeight: '700',
  },
  playAll: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: Q_UI.radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playAllText: {
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 8,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingRight: 4,
    overflow: 'hidden',
  },
  playingRail: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  track: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingLeft: 12,
    paddingRight: 4,
    gap: 10,
    borderRadius: 12,
  },
  rankNum: {
    width: 22,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rankTop: {
    fontWeight: '700',
  },
  coverWrap: {
    width: 40,
    height: 40,
    borderRadius: 9,
    overflow: 'hidden',
    flexShrink: 0,
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 9,
  },
  trackMeta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 6,
  },
  inlineWave: {
    flexShrink: 0,
  },
  trackTitle: {
    flexShrink: 1,
    fontWeight: '600',
  },
  playingTitle: {
    fontWeight: '700',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  subText: {
    flex: 1,
    minWidth: 0,
  },
  rankRight: {
    width: 68,
    alignItems: 'flex-end',
    gap: 5,
    flexShrink: 0,
  },
  countLabel: {
    fontVariant: ['tabular-nums'],
  },
  meterTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 2,
  },
  timeText: {
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
})
