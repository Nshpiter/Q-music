import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Keyboard, View } from 'react-native'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import SourceLogo from '@/components/SourceLogo'
import DragRow from './DragRow'
import { buildQueueRows, filterQueueRows, queueTrack, type QueueRow as Row } from './rows'

import BottomSheet from '@/components/common/BottomSheet'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useIsPlay, usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { getList, updatePlayIndex } from '@/core/player/playInfo'
import { pause, play, playQueueIndex, playTempListByIndex, removeQueueIndex, clearPlayQueue, resetRandomNextMusicInfo } from '@/core/player/player'
import { playbackSession } from '@/core/player/session'
import playerActions from '@/store/player/action'
import { Icon } from '@/components/common/Icon'
import PlayingWave from '../PlayingWave'
import { Q_TOUCH_HIT_SLOP, Q_UI } from '@/theme/ui'

export interface PlayQueueType {
  show: () => void
}

const ITEM_HEIGHT = 64

const QueueItem = ({ index, name, singer, source, isActive, isPlaying, busy, disabled, onPress, onLongPress }: {
  index: number
  name: string
  singer: string
  source: string
  isActive: boolean
  isPlaying: boolean
  busy: boolean
  disabled: boolean
  onPress: () => void
  onLongPress: () => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  return (
    <Button
      accessibilityRole="button"
      accessibilityLabel={`${t(isPlaying ? 'pause' : 'play')} · ${name} · ${singer}`}
      accessibilityState={{ selected: isActive, busy, disabled }}
      disabled={disabled}
      style={{ ...styles.item, flex: 1, backgroundColor: isActive ? theme['q-surface-tint'] : 'transparent', borderRadius: Q_UI.radius.item }}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.index}>
        {busy ? <ActivityIndicator size="small" color={theme['q-accent-text']} /> : isActive
          ? <PlayingWave playing={isPlaying} size={14} color={theme['q-accent-text']} />
          : <Text size={13} color={theme['q-text-secondary']}>{index + 1}</Text>}
      </View>
      <View style={styles.info}>
        <Text numberOfLines={1} size={14} style={isActive ? styles.activeName : undefined} color={isActive ? theme['q-accent-text'] : theme['c-font']}>{name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {source != 'local' ? <SourceLogo source={source} size={12} /> : null}
          <Text numberOfLines={1} size={11} style={{ flex: 1 }} color={theme['q-text-secondary']}>{singer}</Text>
        </View>
      </View>
    </Button>
  )
}

const PlayQueue = forwardRef<PlayQueueType>((_, ref) => {
  const t = useI18n()
  const playInfo = usePlayInfo()
  const playMusicInfo = usePlayMusicInfo()
  const isPlay = useIsPlay()
  const theme = useTheme()
  const [visible, setVisible] = useState(false)
  const [sheetHeight, setSheetHeight] = useState(680)
  const close = useCallback(() => { setVisible(false) }, [])
  const [sorting, setSorting] = useState(false)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [revision, refresh] = useState(0)
  const listRef = useRef<FlatList<Row>>(null)
  const pendingPlay = useRef(false)
  const pendingScroll = useRef(false)
  const [busyKey, setBusyKey] = useState('')
  useEffect(() => {
    const update = () => { refresh(value => value + 1) }
    const unsubscribe = playbackSession.subscribe(update)
    global.app_event.on('myListMusicUpdate', update)
    global.state_event.on('playTempPlayListChanged', update)
    return () => {
      unsubscribe()
      global.app_event.off('myListMusicUpdate', update)
      global.state_event.off('playTempPlayListChanged', update)
    }
  }, [])
  const sourceList = getList(playInfo.playerListId)
  const upcoming = playerState.tempPlayList
  const insertedTrack = playMusicInfo.isTempPlay ? playMusicInfo.musicInfo : null
  // 歌单更新事件也可能原地修改数组，revision 用于刷新该快照。
  const rows = useMemo(() => buildQueueRows(sourceList, upcoming, playInfo.playerPlayIndex, insertedTrack),
    [sourceList, upcoming, playInfo.playerPlayIndex, insertedTrack, revision]) // eslint-disable-line react-hooks/exhaustive-deps
  const results = useMemo(() => filterQueueRows(rows, query), [rows, query])
  const active = (row: Row) => row.kind == 'current' || (row.kind == 'list' && !playMusicInfo.isTempPlay && row.index == playInfo.playerPlayIndex)
  const activeIndex = rows.findIndex(active)
  const scrollToCurrent = () => {
    if (activeIndex >= 0) listRef.current?.scrollToOffset({ offset: Math.max((activeIndex - 1) * ITEM_HEIGHT, 0), animated: false })
  }
  const locateOnOpen = () => {
    if (!pendingScroll.current || !rows.length) return
    pendingScroll.current = false
    scrollToCurrent()
  }
  const endSearch = () => {
    Keyboard.dismiss()
    setSearching(false)
    setQuery('')
  }
  const changeQuery = (value: string) => {
    setQuery(value)
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }
  useImperativeHandle(ref, () => ({
    show() {
      setSheetHeight(Math.min(680, Math.max(300, 218 + (sourceList.length + upcoming.length + (insertedTrack ? 1 : 0)) * ITEM_HEIGHT)))
      pendingScroll.current = true
      setSorting(false)
      setSearching(false)
      setQuery('')
      setVisible(true)
    },
  }))
  const handlePress = async(row: Row) => {
    if (pendingPlay.current || sorting) return
    pendingPlay.current = true; setBusyKey(row.key)
    try {
      if (active(row)) { if (playerState.isPlay) await pause(); else play() } else if (row.kind == 'later') {
        const index = playerState.tempPlayList.findIndex(item => `later:${item.tempId}` == row.key)
        if (index >= 0) await playTempListByIndex(index)
      } else if (row.kind == 'list') {
        const list = getList(playerState.playInfo.playerListId)
        if (playerState.playInfo.playerListId == playInfo.playerListId && list[row.index] === row.music) await playQueueIndex(row.index)
      }
    } catch { toast(t('queue_play_failed')) } finally { pendingPlay.current = false; setBusyKey('') }
  }
  const editQueue = async(row?: Row) => {
    if (pendingPlay.current) return
    pendingPlay.current = true; setBusyKey(row?.key ?? 'clear')
    try {
      if (!row) {
        if (await confirmDialog({ message: t('queue_clear_confirm') })) await clearPlayQueue()
      } else if (row.kind == 'later') {
        const at = playerState.tempPlayList.findIndex(item => `later:${item.tempId}` == row.key)
        if (at >= 0) playerActions.removeTempPlayList(at)
      } else if (row.kind == 'list' && playerState.playInfo.playerListId == playInfo.playerListId && getList(playInfo.playerListId)[row.index] === row.music) await removeQueueIndex(row.index)
    } catch { toast(t('queue_play_failed')) } finally { pendingPlay.current = false; setBusyKey(''); refresh(value => value + 1) }
  }
  const move = (row: Row, direction: number) => {
    if (pendingPlay.current) return
    const anchor = sourceList[playerState.playInfo.playerPlayIndex]
    if (row.kind == 'later') {
      const index = playerState.tempPlayList.findIndex(item => `later:${item.tempId}` == row.key)
      if (index >= 0) playerActions.moveTempPlayList(index, index + direction)
    } else if (row.kind == 'list' && sourceList[row.index] === row.music && playInfo.playerListId == playerState.playInfo.playerListId && playInfo.playerListId && playbackSession.reorder(playInfo.playerListId, sourceList as LX.Player.PlayMusic[], row.index, row.index + direction)) {
      if (playerState.playMusicInfo.isTempPlay && anchor) playerActions.updatePlayIndex(playerState.playInfo.playIndex, getList(playInfo.playerListId).findIndex(item => item.id == anchor.id))
      updatePlayIndex(); resetRandomNextMusicInfo()
    }
  }
  return <BottomSheet visible={visible} transient maxHeight={sheetHeight} onClose={close} onBack={searching ? endSearch : close} onOpened={locateOnOpen} testID="play-queue-sheet">
    {searching ? <View style={styles.searchHeading}>
      <Input autoFocus clearBtn value={query} onChangeText={changeQuery} accessibilityLabel={t('track_search_hint')} placeholder={t('track_search_hint')} returnKeyType="search" containerStyle={styles.searchInput} />
      <View style={[styles.countBadge, { backgroundColor: theme['q-surface-tint'] }]}>
        <Text size={11} style={styles.countText} color={theme['q-accent-text']}>{results.length}</Text>
      </View>
      <Button onPress={endSearch} style={styles.cancel}><Text size={13} style={styles.cancelText} color={theme['q-accent-text']}>{t('cancel')}</Text></Button>
    </View> : <View style={styles.heading}>
      <View style={styles.titleRow}>
        <Text size={17} style={styles.titleText} numberOfLines={1}>{t('play_queue_title')}</Text>
        <View style={[styles.countBadge, { backgroundColor: theme['q-surface-tint'] }]}>
          <Text size={11} style={styles.countText} color={theme['q-accent-text']}>{rows.length}</Text>
        </View>
      </View>
      {rows.length > 0 && <Button accessibilityLabel={t('list_search')} onPress={() => { pendingScroll.current = false; setSorting(false); setSearching(true) }} style={styles.iconButton}><Icon name="search-2" rawSize={19} color={theme['q-text-secondary']} /></Button>}
      <Button accessibilityLabel={t('close')} onPress={close} style={styles.iconButton}><Icon name="close" rawSize={20} color={theme['q-text-secondary']} /></Button>
    </View>}
    {!searching && rows.length > 0 && <View style={[styles.toolbarWrap, { borderBottomColor: theme['q-outline'] }]}>
      <Text size={11} style={styles.hintText} color={theme['q-text-secondary']} numberOfLines={2}>
        {t(playbackSession.continuous && sourceList.every(item => ('progress' in item ? item.metadata.musicInfo.source : item.source) == 'bi') ? 'queue_bilibili_hint' : 'queue_session_local_hint')}
      </Text>
      <View style={styles.actionRow}>
        <Button
          onPress={() => { setSorting(!sorting) }}
          style={[styles.actionPill, { backgroundColor: sorting ? theme['q-surface-tint'] : theme['q-surface-raised'], borderColor: sorting ? theme['q-accent'] : theme['q-outline'] }]}
        >
          <Icon accessible={false} name="menu" rawSize={14} color={sorting ? theme['q-accent-text'] : theme['q-text-secondary']} />
          <Text size={12} style={sorting ? styles.actionActiveText : undefined} color={sorting ? theme['q-accent-text'] : theme['q-text-primary']}>{t(sorting ? 'playlist_order_done' : 'playlist_order_title')}</Text>
        </Button>
        <Button
          hitSlop={Q_TOUCH_HIT_SLOP}
          onPress={scrollToCurrent}
          style={[styles.actionPill, { backgroundColor: theme['q-surface-tint'], borderColor: theme['q-outline'] }]}
        >
          <Text size={12} style={styles.actionActiveText} color={theme['q-accent-text']}>{t('queue_locate')}</Text>
        </Button>
        <Button
          disabled={!!busyKey}
          hitSlop={Q_TOUCH_HIT_SLOP}
          onPress={() => { void editQueue() }}
          style={[styles.actionPill, styles.clearPill, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]}
        >
          <Text size={12} color={theme['q-text-secondary']}>{t('queue_clear')}</Text>
        </Button>
      </View>
    </View>}
    <FlatList ref={listRef} style={styles.list} data={results} keyboardShouldPersistTaps="handled" removeClippedSubviews={false} extraData={`${isPlay}:${sorting}:${busyKey}`} keyExtractor={row => row.key}
      onContentSizeChange={locateOnOpen}
      ListEmptyComponent={<View style={styles.emptyWrap}>
        <Icon name={rows.length && query.trim() ? 'search-2' : 'menu'} rawSize={26} color={theme['q-text-secondary']} />
        <Text size={13} color={theme['q-text-secondary']} style={styles.empty}>{t(rows.length && query.trim() ? 'queue_search_empty' : 'mobile_queue_empty')}</Text>
      </View>}
      getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      renderItem={({ item: row }) => {
        const music = queueTrack(row.music)
        const count = row.kind == 'later' ? upcoming.length : sourceList.length
        return <DragRow height={ITEM_HEIGHT} enabled={sorting && !busyKey && (row.kind == 'list' || row.kind == 'later')} index={row.index} count={count} onMove={steps => { move(row, steps) }}>
          <QueueItem index={row.position} source={music.source} name={music.name} singer={row.kind == 'later' ? `${t('queue_session_next')} · ${music.singer}` : music.singer} isActive={active(row)} isPlaying={active(row) && isPlay} busy={busyKey == row.key} disabled={!!busyKey} onPress={() => { void handlePress(row) }} onLongPress={() => { if (!searching) setSorting(true) }} />
          {!sorting && (row.kind == 'later' || row.kind == 'list') ? <Button disabled={!!busyKey} accessibilityLabel={t('queue_session_remove')} onPress={() => { void editQueue(row) }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}><Text size={18} color={theme['q-text-secondary']}>×</Text></Button> : null}
        </DragRow>
      }} />
  </BottomSheet>
})

const styles = createStyle({
  heading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 48, gap: 4 },
  searchHeading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6, minHeight: 48, gap: 8 },
  searchInput: { flex: 1, minWidth: 0 },
  titleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { flexShrink: 1, fontWeight: '700' },
  countBadge: { minWidth: 24, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignItems: 'center' },
  countText: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  iconButton: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancel: { minHeight: 42, paddingHorizontal: 8, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontWeight: '600' },
  toolbarWrap: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, borderBottomWidth: 0.5 },
  hintText: { lineHeight: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionPill: { minHeight: 36, paddingHorizontal: 12, borderRadius: 12, borderWidth: 0.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionActiveText: { fontWeight: '600' },
  clearPill: { marginLeft: 'auto' },
  emptyWrap: { paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', gap: 10 },
  empty: { textAlign: 'center' },
  list: {
    flex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  index: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeName: {
    fontWeight: '600',
  },
  info: {
    flex: 1,
    flexShrink: 1,
  },
})

export default PlayQueue
