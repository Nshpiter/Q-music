import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, View } from 'react-native'
import Button from '@/components/common/Button'
import SourceLogo from '@/components/SourceLogo'

import Popup, { type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useIsPlay, usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { createStyle, toast } from '@/utils/tools'
import { getList, updatePlayIndex } from '@/core/player/playInfo'
import { pause, play, playQueueIndex, playTempListByIndex, playHistoryIndex, resetRandomNextMusicInfo } from '@/core/player/player'
import { playbackSession } from '@/core/player/session'
import playerActions from '@/store/player/action'
import { Icon } from '@/components/common/Icon'
import { Q_UI } from '@/theme/ui'
import { LIST_IDS } from '@/config/constant'
import { addListMusics } from '@/core/list'
import settingState from '@/store/setting/state'

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

interface Row { key: string, kind: 'list' | 'later' | 'history' | 'current', index: number, music: LX.Player.PlayMusic }
const PlayQueue = forwardRef<PlayQueueType>((_, ref) => {
  const t = useI18n()
  const playInfo = usePlayInfo()
  const playMusicInfo = usePlayMusicInfo()
  const isPlay = useIsPlay()
  const theme = useTheme()
  const [visible, setVisible] = useState(false)
  const [tab, setTab] = useState<'queue' | 'history'>('queue')
  const [sorting, setSorting] = useState(false)
  const [savingQueue, setSavingQueue] = useState(false)
  const savingRef = useRef(false)
  const [, refresh] = useState(0)
  const popupRef = useRef<PopupType>(null)
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
  useEffect(() => { popupRef.current?.setVisible(visible) }, [visible])
  const sourceList = getList(playInfo.playerListId)
  const upcoming = playerState.tempPlayList
  const rows: Row[] = tab == 'history'
    ? playbackSession.history.map((item, index) => ({ key: `history:${index}`, kind: 'history', index, music: item.musicInfo }))
    : sourceList.map((music, index) => ({ key: `list:${music.id}:${index}`, kind: 'list', index, music }))
  if (tab == 'queue') {
    const inserted: Row[] = upcoming.map((item, index) => ({ key: `later:${item.tempId}`, kind: 'later', index, music: item.musicInfo }))
    if (playMusicInfo.isTempPlay && playMusicInfo.musicInfo) inserted.unshift({ key: 'current', kind: 'current', index: 0, music: playMusicInfo.musicInfo })
    rows.splice(Math.max(0, playInfo.playerPlayIndex + 1), 0, ...inserted)
  }
  const active = (row: Row) => row.kind == 'history' ? row.index == playbackSession.cursor : row.kind == 'current' || (row.kind == 'list' && !playMusicInfo.isTempPlay && row.index == playInfo.playerPlayIndex)
  const activeIndex = rows.findIndex(active)
  const saveQueue = async() => {
    if (savingRef.current || tab != 'queue' || !rows.length) return
    savingRef.current = true; setSavingQueue(true)
    try {
      await addListMusics(LIST_IDS.DEFAULT, rows.map(row => 'progress' in row.music ? row.music.metadata.musicInfo : row.music), settingState.setting['list.addMusicLocationType'])
      toast(t('queue_save_audition_done'))
    } catch { toast(t('queue_play_failed')) } finally { savingRef.current = false; setSavingQueue(false) }
  }
  const scrollToCurrent = () => {
    if (activeIndex >= 0) listRef.current?.scrollToOffset({ offset: Math.max((activeIndex - 1) * ITEM_HEIGHT, 0), animated: false })
  }
  useImperativeHandle(ref, () => ({ show() { pendingScroll.current = true; setVisible(true) } }))
  const handlePress = async(row: Row) => {
    if (pendingPlay.current || sorting) return
    pendingPlay.current = true; setBusyKey(row.key)
    try {
      if (active(row)) { if (playerState.isPlay) await pause(); else play() } else if (row.kind == 'history') await playHistoryIndex(row.index)
      else if (row.kind == 'later') {
        const index = playerState.tempPlayList.findIndex(item => `later:${item.tempId}` == row.key)
        if (index >= 0) await playTempListByIndex(index)
      } else if (row.kind == 'list') {
        const list = getList(playerState.playInfo.playerListId)
        if (playerState.playInfo.playerListId == playInfo.playerListId && list[row.index] === row.music) await playQueueIndex(row.index)
      }
    } catch { toast(t('queue_play_failed')) } finally { pendingPlay.current = false; setBusyKey('') }
  }
  const move = (row: Row, direction: number) => {
    if (pendingPlay.current) return
    const anchor = sourceList[playerState.playInfo.playerPlayIndex]
    if (row.kind == 'later') {
      const index = playerState.tempPlayList.findIndex(item => `later:${item.tempId}` == row.key)
      if (index >= 0) playerActions.moveTempPlayList(index, index + direction)
    } else if (row.kind == 'list' && playInfo.playerListId && playbackSession.reorder(playInfo.playerListId, sourceList as LX.Player.PlayMusic[], row.index, row.index + direction)) {
      if (playerState.playMusicInfo.isTempPlay && anchor) playerActions.updatePlayIndex(playerState.playInfo.playIndex, getList(playInfo.playerListId).findIndex(item => item.id == anchor.id))
      updatePlayIndex(); resetRandomNextMusicInfo()
    }
  }
  return visible ? <Popup ref={popupRef} transient title={`${t('play_queue_title')} · ${rows.length}`} onHide={() => { setVisible(false); setSorting(false) }} onShow={scrollToCurrent}>
    <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 6 }}>
      {(['queue', 'history'] as const).map(value => <Button key={value} accessibilityState={{ selected: value == tab }} onPress={() => { setTab(value); setSorting(false) }} style={{ flex: 1, minHeight: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: tab == value ? theme['q-surface-tint'] : 'transparent' }}><Text size={13} color={tab == value ? theme['q-accent-text'] : theme['q-text-secondary']}>{t(value == 'queue' ? 'play_queue_title' : 'queue_session_history')}</Text></Button>)}
      {tab == 'queue' ? <Button onPress={() => { setSorting(!sorting) }} style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 12 }}><Text size={12} color={theme['q-accent-text']}>{t(sorting ? 'playlist_order_done' : 'playlist_order_title')}</Text></Button> : null}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: 40 }}>
      <Text size={11} style={{ flex: 1 }} color={theme['q-text-secondary']}>{t('queue_session_local_hint')}</Text>
      <Button onPress={scrollToCurrent} style={{ padding: 10, borderRadius: 10 }}><Text size={12} color={theme['q-accent-text']}>{t('queue_locate')}</Text></Button>
    </View>
    {tab == 'queue' && rows.length ? <Button disabled={savingQueue} onPress={() => { void saveQueue() }} style={{ marginHorizontal: 20, marginBottom: 6, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: theme['q-surface-tint'] }}><Text size={12} color={theme['q-accent-text']}>{t('queue_save_audition')}</Text></Button> : null}
    <FlatList ref={listRef} style={styles.list} data={rows} extraData={`${isPlay}:${sorting}:${busyKey}`} keyExtractor={row => row.key}
      onContentSizeChange={() => { if (pendingScroll.current && rows.length) { pendingScroll.current = false; scrollToCurrent() } }}
      ListEmptyComponent={<Text style={styles.empty}>{t(tab == 'queue' ? 'mobile_queue_empty' : 'queue_session_history_empty')}</Text>}
      getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      renderItem={({ item: row, index }) => {
        const music = 'progress' in row.music ? row.music.metadata.musicInfo : row.music
        const count = row.kind == 'later' ? upcoming.length : sourceList.length
        return <View style={{ height: ITEM_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
          <QueueItem index={index} source={music.source} name={music.name} singer={row.kind == 'later' ? `${t('queue_session_next')} · ${music.singer}` : music.singer} isActive={active(row)} isPlaying={active(row) && isPlay} busy={!!busyKey} onPress={() => { void handlePress(row) }} onLongPress={() => { if (tab == 'queue') setSorting(true) }} />
          {sorting && (row.kind == 'later' || row.kind == 'list') ? <View style={{ flexDirection: 'row', paddingRight: 8 }}>
            {([-1, 1] as const).map(direction => <Button key={direction} disabled={!!busyKey || row.index + direction < 0 || row.index + direction >= count} accessibilityLabel={t(direction < 0 ? 'playlist_order_up' : 'playlist_order_down')} onPress={() => { move(row, direction) }} style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}><Icon name={direction < 0 ? 'chevron-up' : 'chevron-down'} size={18} color={theme['q-accent-text']} /></Button>)}
          </View> : row.kind == 'later' ? <Button disabled={!!busyKey} accessibilityLabel={t('queue_session_remove')} onPress={() => { const at = playerState.tempPlayList.findIndex(item => `later:${item.tempId}` == row.key); if (at >= 0) playerActions.removeTempPlayList(at) }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}><Text size={18} color={theme['q-text-secondary']}>×</Text></Button> : null}
        </View>
      }} />
  </Popup> : null
})

const styles = createStyle({
  locate: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'flex-end' },
  empty: { padding: 28, textAlign: 'center' },
  list: {
    maxHeight: 420,
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
