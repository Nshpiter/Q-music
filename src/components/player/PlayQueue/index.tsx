import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'

import Popup, { type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import { getList } from '@/core/player/playInfo'
import { playListById } from '@/core/player/player'
import { Q_UI } from '@/theme/ui'

export interface PlayQueueType {
  show: () => void
}

const ITEM_HEIGHT = 48

const QueueItem = ({ id, index, name, singer, isActive, onPress }: {
  id: string
  index: number
  name: string
  singer: string
  isActive: boolean
  onPress: (id: string, index: number) => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity
      style={{ ...styles.item, backgroundColor: isActive ? theme['q-surface-tint'] : 'transparent', borderRadius: isActive ? Q_UI.radius.item : 0 }}
      activeOpacity={0.6}
      onPress={() => { onPress(id, index) }}
    >
      <Text size={13} color={isActive ? theme['q-accent-text'] : theme['q-text-secondary']} style={styles.index}>{index + 1}</Text>
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
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)
  const listRef = useRef<FlatList<LX.Music.MusicInfo>>(null)

  // 下载列表固定返回空数组，播放队列仅展示常规歌单
  const list = getList(playInfo.playerListId ?? '') as LX.Music.MusicInfo[]
  const activeId = playMusicInfo.musicInfo?.id

  useImperativeHandle(ref, () => ({
    show() {
      if (visible) {
        popupRef.current?.setVisible(true)
        return
      }
      setVisible(true)
      requestAnimationFrame(() => {
        popupRef.current?.setVisible(true)
        // 滚动到当前播放歌曲
        const index = list.findIndex(m => m.id == activeId)
        if (index > 10) {
          setTimeout(() => {
            listRef.current?.scrollToOffset({ offset: Math.max(index * ITEM_HEIGHT - 120, 0) })
          }, 100)
        }
      })
    },
  }))

  const handlePress = (id: string, _index: number) => {
    if (!playInfo.playerListId) return
    popupRef.current?.setVisible(false)
    void playListById(playInfo.playerListId, id)
  }

  return (
    visible
      ? (
        <Popup ref={popupRef} title={t('play_queue_title')}>
          <FlatList
            ref={listRef}
            style={styles.list}
            data={list}
            keyExtractor={item => item.id}
            getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
            renderItem={({ item, index }) => (
              <QueueItem
                id={item.id}
                index={index}
                name={item.name}
                singer={item.singer}
                isActive={item.id == activeId}
                onPress={handlePress}
              />
            )}
          />
        </Popup>
        )
      : null
  )
})

const styles = createStyle({
  list: {
    maxHeight: 420,
  },
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
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
