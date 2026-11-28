import DownloadLocationEntry from '@/components/DownloadLocationEntry'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Animated, Easing, FlatList, ScrollView, StyleSheet, View } from 'react-native'

import Text from '@/components/common/Text'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import TrackArtwork from '@/components/TrackArtwork'
import SourceLogo from '@/components/SourceLogo'
import { Icon } from '@/components/common/Icon'
import { ActivePlayingWave } from '@/components/player/PlayingWave'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { getDownloadTasks, subscribeDownloadTasks } from '@/core/download/store'
import { deleteDownloadTask, retryDownload } from '@/core/download/worker'
import { playDownloadTask, playAllDownloads } from '@/core/download/play'
import type { DownloadTaskInfo } from '@/core/download/types'
import { QUALITY_BADGE } from '@/config/constant'
import { Q_UI } from '@/theme/ui'
import { useMotion } from '@/utils/useMotion'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { setNavActiveId } from '@/core/common'
import commonState from '@/store/common/state'
import { useDockInset } from '@/components/common/DockInset'
import { useIsPlay, usePlayMusicInfo } from '@/store/player/hook'

const filters = ['all', 'active', 'completed', 'error'] as const
type Filter = typeof filters[number]
const matchesFilter = (task: DownloadTaskInfo, filter: Filter) => filter == 'all' || (filter == 'active' ? task.status == 'waiting' || task.status == 'run' : task.status == filter)

const TaskItem = ({ task, busy, playing, playDisabled, onPlay, onDelete, onRetry }: {
  task: DownloadTaskInfo
  busy: boolean
  playing: boolean
  playDisabled: boolean
  onPlay: (id: string) => void
  onDelete: (task: DownloadTaskInfo) => void
  onRetry: (id: string) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const motion = useMotion()
  const progress = Number.isFinite(task.progress) ? Math.max(0, Math.min(100, Math.round(task.progress))) : 0
  const progressAnim = useRef(new Animated.Value(progress)).current

  useEffect(() => {
    progressAnim.stopAnimation()
    if (motion && task.status == 'run') {
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start()
    } else {
      progressAnim.setValue(progress)
    }
    return () => { progressAnim.stopAnimation() }
  }, [motion, progress, progressAnim, task.status])

  const statusText = useMemo(() => {
    switch (task.status) {
      case 'waiting':
        return t('download_status_waiting')
      case 'run':
        return task.speed ? `${progress}% · ${task.speed}` : `${progress}%`
      case 'error':
        return task.statusText || t('download_status_error')
      case 'completed':
        return t('download_status_completed')
      default:
        return ''
    }
  }, [task.status, progress, task.speed, task.statusText, t])

  return (
    <View style={[styles.item, { backgroundColor: playing ? theme['q-surface-tint'] : theme['q-surface-raised'], borderColor: playing ? theme['q-accent'] : theme['q-outline'] }]}>
      {playing ? <View pointerEvents="none" style={[styles.playingRail, { backgroundColor: theme['q-accent'] }]} /> : null}
      <View style={[styles.coverWrap, { backgroundColor: theme['q-surface-tint'] }]}>
        <TrackArtwork item={task.musicInfo} style={styles.cover} />
      </View>
      <View style={styles.itemInfo}>
        <View style={styles.titleLine}>
          <Text numberOfLines={2} size={14} style={[styles.itemTitle, playing && styles.playingTitle]} color={playing ? theme['q-accent-text'] : theme['c-font']}>{task.musicInfo.name}</Text>
          {playing ? <ActivePlayingWave size={12} color={theme['q-accent-text']} style={styles.inlineWave} /> : null}
        </View>
        <View style={styles.itemSub}>
          <SourceLogo source={task.musicInfo.source} size={13} />
          <Text numberOfLines={1} size={11} style={styles.singerText} color={theme['q-text-secondary']}>{task.musicInfo.singer}</Text>
          <Badge type={task.quality == 'flac' || task.quality == 'flac24bit' ? 'normal' : 'secondary'}>{QUALITY_BADGE[task.quality]}</Badge>
        </View>
        {
          task.status == 'run'
            ? (
              <View accessibilityRole="progressbar" accessibilityLabel={t('download')} accessibilityValue={{ min: 0, max: 100, now: progress }} style={{ ...styles.progressTrack, backgroundColor: theme['q-outline'] }}>
                <Animated.View style={[styles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }), backgroundColor: theme['q-accent'] }]} />
              </View>
              )
            : null
        }
        <Text size={11} color={task.status == 'error' ? theme['c-badge-tertiary'] : theme['q-text-secondary']} style={styles.status}>{busy ? t('loading') : statusText}</Text>
      </View>
      <View style={styles.itemActions}>
        {task.status == 'completed' ? <IconButton size={40} iconSize={18} name={playing ? 'pause' : 'play'} accessibilityLabel={t(playing ? 'pause' : 'download_play_local')} selected={playing} variant="tonal" disabled={busy || playDisabled} onPress={() => { onPlay(task.id) }} /> : null}
        {
          task.status == 'error'
            ? (
              <IconButton size={40} iconSize={18} name="available_updates" accessibilityLabel={t('download_retry')} disabled={busy} onPress={() => { onRetry(task.id) }} />
              )
            : null
        }
        {
          task.status != 'run'
            ? (
              <IconButton size={40} iconSize={18} name="close" accessibilityLabel={t('download_remove_record')} disabled={busy} onPress={() => { onDelete(task) }} />
              )
            : null
        }
      </View>
    </View>
  )
}

export default () => {
  const dockInset = useDockInset()
  const theme = useTheme()
  const t = useI18n()
  const [tasks, setTasks] = useState<DownloadTaskInfo[]>(getDownloadTasks)
  const [filter, setFilter] = useState<Filter>('all')
  const visibleTasks = useMemo(() => tasks.filter(task => matchesFilter(task, filter)), [tasks, filter])
  const counts = useMemo(() => Object.fromEntries(filters.map(key => [key, tasks.filter(task => matchesFilter(task, key)).length])), [tasks])
  const listRef = useRef<FlatList<DownloadTaskInfo>>(null)
  const { musicInfo } = usePlayMusicInfo()
  const isPlay = useIsPlay()
  const currentPath = musicInfo && !('progress' in musicInfo) && musicInfo.source == 'local' ? musicInfo.meta.filePath : null
  const [busyIds, setBusyIds] = useState<string[]>([])
  const pendingIds = useRef(new Set<string>())
  const [playingId, setPlayingId] = useState<string | null>(null)
  const playPending = useRef(false)
  const handlePlay = async(id: string) => {
    if (playPending.current || pendingIds.current.has(id)) return
    playPending.current = true
    pendingIds.current.add(id)
    setPlayingId(id)
    setBusyIds([...pendingIds.current])
    try {
      await playDownloadTask(id)
    } catch (err) {
      const key = err instanceof Error && (err.message == 'download_play_missing' || err.message == 'storage_all_files_unconfirmed') ? err.message : 'download_play_failed'
      toast(t(key))
    } finally {
      playPending.current = false
      pendingIds.current.delete(id)
      setPlayingId(null)
      setBusyIds([...pendingIds.current])
    }
  }
  const removeTask = async(taskId: string, deleteFile: boolean) => {
    if (pendingIds.current.has(taskId)) return
    pendingIds.current.add(taskId)
    setBusyIds([...pendingIds.current])
    try {
      await deleteDownloadTask(taskId, deleteFile)
    } catch {
      toast(t('download_remove_failed'))
    } finally {
      pendingIds.current.delete(taskId)
      setBusyIds([...pendingIds.current])
    }
  }
  const handleDelete = (task: DownloadTaskInfo) => {
    if (pendingIds.current.has(task.id)) return
    if (!task.filePath) { void removeTask(task.id, false); return }
    Alert.alert(t('download_remove_record'), t('download_remove_tip', { name: task.musicInfo.name }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('download_remove_record'), onPress: () => { void removeTask(task.id, false) } },
      { text: t('download_remove_file'), style: 'destructive', onPress: () => { void removeTask(task.id, true) } },
    ])
  }
  useBackHandler(useCallback(() => {
    if (commonState.navActiveId != 'download' || Object.keys(commonState.componentIds).length != 1) return false
    setNavActiveId('nav_love')
    return true
  }, []))

  useEffect(() => {
    const unsubscribe = subscribeDownloadTasks(setTasks)
    return unsubscribe
  }, [])

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }}>
      <View style={styles.content}>
        <DownloadLocationEntry />
        <Button
          disabled={!tasks.some(task => task.status == 'completed') || !!playingId}
          onPress={() => {
            if (playPending.current) return
            playPending.current = true; setPlayingId('all')
            void playAllDownloads().catch(() => { toast(t('download_play_failed')) }).finally(() => { playPending.current = false; setPlayingId(null) })
          }}
          style={[styles.playAllBtn, { backgroundColor: theme['q-surface-tint'], borderColor: theme['q-outline'] }]}
        >
          <Icon accessible={false} name="play-outline" size={16} color={theme['q-accent-text']} />
          <Text size={13} style={styles.playAllText} color={theme['q-accent-text']}>{t('play_all')} · {tasks.filter(task => task.status == 'completed').length}</Text>
        </Button>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filters}>
          {filters.map(key => (
            <Button key={key} accessibilityRole="tab" accessibilityState={{ selected: key == filter }} style={[styles.filter, { borderColor: key == filter ? theme['q-accent'] : theme['q-outline'], backgroundColor: key == filter ? theme['q-surface-tint'] : theme['q-surface-raised'] }]} onPress={() => {
              setFilter(key)
              listRef.current?.scrollToOffset({ offset: 0, animated: false })
            }}>
              <Text size={13} color={key == filter ? theme['q-accent-text'] : theme['q-text-secondary']}>{t(`download_filter_${key}`)} · {counts[key]}</Text>
            </Button>
          ))}
        </ScrollView>
        <FlatList
          ref={listRef}
          contentContainerStyle={[styles.listContent, { paddingBottom: dockInset + 8 }, !visibleTasks.length && styles.emptyList]}
          style={styles.list}
          data={visibleTasks}
          extraData={{ busyIds, playingId, currentPath, isPlay }}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TaskItem
              task={item} busy={busyIds.includes(item.id)} playing={!!currentPath && item.filePath == currentPath}
              playDisabled={playingId != null} onPlay={id => { void handlePlay(id) }} onDelete={handleDelete} onRetry={retryDownload}
            />
          )}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme['q-surface-tint'], borderColor: theme['q-outline'] }]}>
                <Icon name="download-2" size={28} color={theme['q-accent-text']} />
              </View>
              <Text size={15} style={styles.emptyText}>{t(filter == 'all' ? 'download_empty_title' : 'download_filter_empty')}</Text>
              <Text size={12} color={theme['q-text-secondary']} style={styles.emptyHint}>{t(filter == 'all' ? 'download_empty_hint' : 'download_filter_hint')}</Text>
              {filter != 'all' ? <Button style={[styles.filter, { backgroundColor: theme['q-surface-tint'], borderColor: theme['q-outline'] }]} onPress={() => { setFilter('all') }}><Text size={13} color={theme['q-accent-text']}>{t('download_filter_all')}</Text></Button> : null}
            </View>
          )}
        />
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center' },
  playAllBtn: {
    minHeight: 44,
    borderRadius: 14,
    marginHorizontal: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playAllText: {
    fontWeight: '700',
  },
  filterBar: { flexGrow: 0, flexShrink: 0 },
  filters: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filter: { minHeight: Q_UI.touchSize, paddingHorizontal: 14, justifyContent: 'center', borderRadius: Q_UI.radius.control, borderWidth: 1 },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingVertical: 9,
    paddingLeft: 12,
    paddingRight: 6,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
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
  itemInfo: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 10,
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
  itemTitle: {
    flexShrink: 1,
    fontWeight: '600',
  },
  playingTitle: {
    fontWeight: '700',
  },
  itemSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  singerText: {
    flexShrink: 1,
    marginRight: 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 7,
    marginBottom: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  status: { marginTop: 4 },
  emptyList: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 12,
    fontWeight: '600',
  },
  emptyHint: { maxWidth: 360, textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 16, paddingHorizontal: 16 },
})
