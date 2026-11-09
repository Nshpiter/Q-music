import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, View } from 'react-native'
import Button from '@/components/common/Button'
import SourceLogo from '@/components/SourceLogo'
import DragRow from './DragRow'

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
import { Q_UI } from '@/theme/ui'

export interface PlayQueueType {
  show: () => void
}

const ITEM_HEIGHT = 64

const QueueItem = ({ index, name, singer, source, isActive, isPlaying, busy, onPress, onLongPress }: {
  index: number
  name: string
  singer: string
  source: string
  isActive: boolean
  isPlaying: boolean
  busy: boolean
  onPress: () => void
  onLongPress: () => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  return (
    <Button
      accessibilityRole="button"
      accessibilityLabel={`${t(isPlaying ? 'pause' : 'play')} · ${name} · ${singer}`}
      accessibilityState={{ selected: isActive, busy, disabled: busy }}
      disabled={busy}
      style={{ ...styles.item, flex: 1, backgroundColor: isActive ? theme['q-surface-tint'] : 'transparent', borderRadius: Q_UI.radius.item }}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.index}>
        {busy ? <ActivityIndicator size="small" color={theme['q-accent-text']} /> : isActive
          ? <Icon accessible={false} name={isPlaying ? 'pause' : 'play'} size={16} color={theme['q-accent-text']} />
          : <Text size={13} color={theme['q-text-secondary']}>{index + 1}</Text>}
      </View>
      <View style={styles.info}>
        <Text numberOfLines={1} size={14} color={isActive ? theme['q-accent-text'] : theme['c-font']}>{name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {source != 'local' ? <SourceLogo source={source} size={12} /> : null}
          <Text numberOfLines={1} size={11} style={{ flex: 1 }} color={theme['q-text-secondary']}>{singer}</Text>
        </View>
      </View>
    </Button>
  )
}

interface Row { key: string, kind: 'list' | 'later' | 'current', index: number, music: LX.Player.PlayMusic }
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
  const [, refresh] = useState(0)
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
  const rows: Row[] = sourceList.map((music, index) => ({ key: `list:${music.id}:${index}`, kind: 'list', index, music }))
  {
    const inserted: Row[] = upcoming.map((item, index) => ({ key: `later:${item.tempId}`, kind: 'later', index, music: item.musicInfo }))
    if (playMusicInfo.isTempPlay && playMusicInfo.musicInfo) inserted.unshift({ key: 'current', kind: 'current', index: 0, music: playMusicInfo.musicInfo })
    rows.splice(Math.max(0, playInfo.playerPlayIndex + 1), 0, ...inserted)
  }
  const active = (row: Row) => row.kind == 'current' || (row.kind == 'list' && !playMusicInfo.isTempPlay && row.index == playInfo.playerPlayIndex)
  const activeIndex = rows.findIndex(active)
  const scrollToCurrent = () => {
    if (activeIndex >= 0) listRef.current?.scrollToOffset({ offset: Math.max((activeIndex - 1) * ITEM_HEIGHT, 0), animated: false })
  }
  useImperativeHandle(ref, () => ({ show() { setSheetHeight(Math.min(680, Math.max(300, 218 + (sourceList.length + upcoming.length + (playMusicInfo.isTempPlay ? 1 : 0)) * ITEM_HEIGHT))); pendingScroll.current = true; setSorting(false); setVisible(true) } }))
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
      } else if (row.kind == 'list' && getList(playInfo.playerListId)[row.index] === row.music) await removeQueueIndex(row.index)
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
  return <BottomSheet visible={visible} transient maxHeight={sheetHeight} onClose={close} onClosed={() => { setSorting(false) }} onOpened={scrollToCurrent} testID="play-queue-sheet">
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: 48 }}>
      <Text size={17} style={{ flex: 1, fontWeight: '600' }}>{t('play_queue_title')} · {rows.length}</Text>
      <Button accessibilityLabel={t('close')} onPress={close} style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}><Icon name="close" rawSize={20} color={theme['q-text-secondary']} /></Button>
    </View>
    <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 6 }}>
      <Button onPress={() => { setSorting(!sorting) }} style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 12 }}><Text size={12} color={theme['q-accent-text']}>{t(sorting ? 'playlist_order_done' : 'playlist_order_title')}</Text></Button>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: 40 }}>
      <Text size={11} style={{ flex: 1 }} color={theme['q-text-secondary']}>{t(playbackSession.continuous && sourceList.every(item => ('progress' in item ? item.metadata.musicInfo.source : item.source) == 'bi') ? 'queue_bilibili_hint' : 'queue_session_local_hint')}</Text>
      <Button onPress={scrollToCurrent} style={{ padding: 10, borderRadius: 10 }}><Text size={12} color={theme['q-accent-text']}>{t('queue_locate')}</Text></Button>
    </View>
    {rows.length ? <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8 }}>
      <Button disabled={!!busyKey} onPress={() => { void editQueue() }} style={{ padding: 10, borderRadius: 10 }}><Text size={12} color={theme['q-text-secondary']}>{t('queue_clear')}</Text></Button>
      </View> : null}
    <FlatList ref={listRef} style={styles.list} data={rows} removeClippedSubviews={false} extraData={`${isPlay}:${sorting}:${busyKey}`} keyExtractor={row => row.key}
      onContentSizeChange={() => { if (pendingScroll.current && rows.length) { pendingScroll.current = false; scrollToCurrent() } }}
      ListEmptyComponent={<Text style={styles.empty}>{t('mobile_queue_empty')}</Text>}
      getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      renderItem={({ item: row, index }) => {
        const music = 'progress' in row.music ? row.music.metadata.musicInfo : row.music
        const count = row.kind == 'later' ? upcoming.length : sourceList.length
        return <DragRow height={ITEM_HEIGHT} enabled={sorting && !busyKey && (row.kind == 'list' || row.kind == 'later')} index={row.index} count={count} onMove={steps => { move(row, steps) }}>
          <QueueItem index={index} source={music.source} name={music.name} singer={row.kind == 'later' ? `${t('queue_session_next')} · ${music.singer}` : music.singer} isActive={active(row)} isPlaying={active(row) && isPlay} busy={!!busyKey} onPress={() => { void handlePress(row) }} onLongPress={() => { setSorting(true) }} />
          {!sorting && (row.kind == 'later' || row.kind == 'list') ? <Button disabled={!!busyKey} accessibilityLabel={t('queue_session_remove')} onPress={() => { void editQueue(row) }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}><Text size={18} color={theme['q-text-secondary']}>×</Text></Button> : null}
        </DragRow>
      }} />
  </BottomSheet>
})

const styles = createStyle({
  locate: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'flex-end' },
  empty: { padding: 28, textAlign: 'center' },
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
  },
  info: {
    flex: 1,
    flexShrink: 1,
  },
})

export default PlayQueue
