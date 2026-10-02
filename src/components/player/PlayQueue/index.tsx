import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, TouchableOpacity, View } from 'react-native'

import Popup, { type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useIsPlay, usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { createStyle, toast } from '@/utils/tools'
import { getList } from '@/core/player/playInfo'
import { pause, play, playList } from '@/core/player/player'
import { Icon } from '@/components/common/Icon'
import { Q_UI } from '@/theme/ui'

export interface PlayQueueType {
  show: () => void
}

const ITEM_HEIGHT = 64

const QueueItem = ({ index, name, singer, isActive, isPlaying, busy, onPress }: {
  index: number
  name: string
  singer: string
  isActive: boolean
  isPlaying: boolean
  busy: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${t(isPlaying ? 'pause' : 'play')} · ${name} · ${singer}`}
      accessibilityState={{ selected: isActive, busy, disabled: busy }}
      disabled={busy}
      style={{ ...styles.item, backgroundColor: isActive ? theme['q-surface-tint'] : 'transparent', borderRadius: isActive ? Q_UI.radius.item : 0 }}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <View style={styles.index}>
        {busy ? <ActivityIndicator size="small" color={theme['q-accent-text']} /> : isActive
          ? <Icon accessible={false} name={isPlaying ? 'pause' : 'play'} size={16} color={theme['q-accent-text']} />
          : <Text size={13} color={theme['q-text-secondary']}>{index + 1}</Text>}
      </View>
      <View style={styles.info}>
        <Text numberOfLines={1} size={14} color={isActive ? theme['q-accent-text'] : theme['c-font']}>{name}</Text>
        <Text numberOfLines={1} size={11} color={theme['q-text-secondary']}>{singer}</Text>
      </View>
    </TouchableOpacity>
  )
}

const PlayQueue = forwardRef<PlayQueueType>((_, ref) => {
  const t = useI18n()
  const playInfo = usePlayInfo()
  const playMusicInfo = usePlayMusicInfo()
  const isPlay = useIsPlay()
  const theme = useTheme()
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)
  const listRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
  const pendingPlay = useRef(false)
  const pendingScroll = useRef(false)
  const [busyIndex, setBusyIndex] = useState(-1)
  const [list, setList] = useState<LX.Music.MusicInfo[]>([])

  // 下载列表固定返回空数组，播放队列仅展示常规歌单
  useEffect(() => {
    const refresh = () => { setList([...(getList(playInfo.playerListId ?? '') as LX.Music.MusicInfo[])]) }
    refresh()
    const handleChange = (ids: string[]) => {
      if (playInfo.playerListId && ids.includes(playInfo.playerListId)) refresh()
    }
    global.app_event.on('myListMusicUpdate', handleChange)
    return () => { global.app_event.off('myListMusicUpdate', handleChange) }
  }, [playInfo.playerListId, visible])

  useEffect(() => { popupRef.current?.setVisible(visible) }, [visible])

  const activeIndex = playMusicInfo.isTempPlay || !playMusicInfo.musicInfo ? -1 : playInfo.playerPlayIndex
  const scrollToCurrent = () => {
    if (activeIndex < 0 || activeIndex >= list.length) return
    listRef.current?.scrollToOffset({ offset: Math.max((activeIndex - 2) * styles.item.height, 0), animated: false })
  }

  useImperativeHandle(ref, () => ({
    show() {
      pendingScroll.current = true
      setVisible(true)
    },
  }))

  const handlePress = async(item: LX.Music.MusicInfo, index: number) => {
    const listId = playerState.playInfo.playerListId
    if (!listId || listId != playInfo.playerListId || pendingPlay.current) return
    const latest = getList(listId) as LX.Music.MusicInfo[]
    const matches = (music?: LX.Music.MusicInfo) => music?.id == item.id && music?.source == item.source
    const targetIndex = matches(latest[index]) ? index : latest.findIndex(matches)
    if (targetIndex < 0) { setList([...latest]); return }
    pendingPlay.current = true
    setBusyIndex(targetIndex)
    try {
      if (!playerState.playMusicInfo.isTempPlay && playerState.playMusicInfo.musicInfo && targetIndex == playerState.playInfo.playerPlayIndex) {
        if (playerState.isPlay) await pause()
        else play()
      } else await playList(listId, targetIndex)
    } catch {
      toast(t('queue_play_failed'))
    } finally {
      pendingPlay.current = false
      setBusyIndex(-1)
    }
  }

  return (
    visible
      ? (
        <Popup ref={popupRef} title={`${t('play_queue_title')} · ${list.length}`} onHide={() => { setVisible(false) }} onShow={scrollToCurrent}>
          {activeIndex >= 0 && activeIndex < list.length
            ? <TouchableOpacity accessibilityRole="button" style={styles.locate} onPress={scrollToCurrent}>
                <Text size={12} color={theme['q-accent-text']}>{t('queue_locate')}</Text>
              </TouchableOpacity>
            : null}
          <FlatList
            ref={listRef}
            style={styles.list}
            data={list}
            onContentSizeChange={() => {
              if (!pendingScroll.current || !list.length) return
              pendingScroll.current = false
              scrollToCurrent()
            }}
            ListEmptyComponent={<Text style={styles.empty}>{t('mobile_queue_empty')}</Text>}
            keyExtractor={(item, index) => `${item.source}_${item.id}_${index}`}
            getItemLayout={(_, index) => ({ length: styles.item.height, offset: styles.item.height * index, index })}
            renderItem={({ item, index }) => (
              <QueueItem
                index={index}
                name={item.name}
                singer={item.singer}
                isActive={index == activeIndex}
                isPlaying={index == activeIndex && isPlay}
                busy={index == busyIndex}
                onPress={() => { void handlePress(item, index) }}
              />
            )}
          />
        </Popup>
        )
      : null
  )
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
