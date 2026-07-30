import { memo, useRef } from 'react'
import { StyleSheet, View, TouchableOpacity } from 'react-native'
// import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Badge, { type BadgeType } from '@/components/common/Badge'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import { createStyle, type RowInfo } from '@/utils/tools'

export const ITEM_HEIGHT = 54

const useQualityTag = (musicInfo: LX.Music.MusicInfoOnline) => {
  const t = useI18n()
  let info: { type: BadgeType | null, text: string } = { type: null, text: '' }
  if (musicInfo.meta._qualitys.flac24bit) {
    info.type = 'secondary'
    info.text = t('quality_lossless_24bit')
  } else if (musicInfo.meta._qualitys.flac ?? musicInfo.meta._qualitys.ape) {
    info.type = 'secondary'
    info.text = t('quality_lossless')
  } else if (musicInfo.meta._qualitys['320k']) {
    info.type = 'tertiary'
    info.text = t('quality_high_quality')
  }

  return info
}

export default memo(({ item, index, showSource, onPress, onLongPress, onShowMenu, selectedList, rowInfo, isShowAlbumName, isShowInterval }: {
  item: LX.Music.MusicInfoOnline
  index: number
  showSource?: boolean
  onPress: (item: LX.Music.MusicInfoOnline, index: number) => void
  onLongPress: (item: LX.Music.MusicInfoOnline, index: number) => void
  onShowMenu: (item: LX.Music.MusicInfoOnline, index: number, position: { x: number, y: number, w: number, h: number }) => void
  selectedList: LX.Music.MusicInfoOnline[]
  rowInfo: RowInfo
  isShowAlbumName: boolean
  isShowInterval: boolean
}) => {
  const theme = useTheme()
  const playMusicInfo = usePlayMusicInfo()

  const isSelected = selectedList.includes(item)
  const isPlaying = playMusicInfo.musicInfo?.id == item.id

  const moreButtonRef = useRef<TouchableOpacity>(null)
  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        // console.log(fx, fy, width, height, px, py)
        onShowMenu(item, index, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }
  const tagInfo = useQualityTag(item)

  const singer = `${item.singer}${isShowAlbumName && item.meta.albumName ? ` · ${item.meta.albumName}` : ''}`

  return (
    <View style={[styles.row, { width: rowInfo.rowWidth, height: ITEM_HEIGHT }]}>
      <View style={[
        styles.listItem,
        isPlaying
          ? {
              backgroundColor: theme['q-surface-tint'],
              borderColor: theme['c-primary-alpha-700'],
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: 10,
            }
          : isSelected
            ? {
                backgroundColor: theme['c-primary-light-300-alpha-800'],
                borderRadius: 10,
              }
            : {
                backgroundColor: 'transparent',
                borderBottomColor: theme.isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(40, 50, 66, 0.06)',
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
      ]}>
        <TouchableOpacity style={styles.listItemLeft} onPress={() => { onPress(item, index) }} onLongPress={() => { onLongPress(item, index) }}>
          {
            isPlaying
              ? <Icon style={styles.sn} name="play-outline" size={13} color={theme['q-accent-text']} />
              : <Text style={styles.sn} size={13} color={theme['q-text-secondary']}>{index + 1}</Text>
          }
          <View style={styles.itemInfo}>
            <Text style={isPlaying ? styles.playingTitle : undefined} color={isPlaying ? theme['q-accent-text'] : theme['c-font']} numberOfLines={1}>{item.name}</Text>
            <View style={styles.listItemSingle}>
              { tagInfo.type ? <Badge type={tagInfo.type}>{tagInfo.text}</Badge> : null }
              { showSource ? <Badge type="tertiary">{item.source}</Badge> : null }
              <Text style={styles.listItemSingleText} size={11} color={theme['q-text-secondary']} numberOfLines={1}>{singer}</Text>
            </View>
          </View>
          {
            isShowInterval ? (
              <Text size={12} color={theme['q-text-secondary']} numberOfLines={1}>{item.interval}</Text>
            ) : null
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton}>
          <Icon name="dots-vertical" style={{ color: theme['q-text-secondary'] }} size={12} />
        </TouchableOpacity>
      </View>
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index &&
    prevProps.isShowAlbumName === nextProps.isShowAlbumName &&
    prevProps.isShowInterval === nextProps.isShowInterval &&
    nextProps.selectedList.includes(nextProps.item) == prevProps.selectedList.includes(nextProps.item)
  )
})

const styles = createStyle({
  row: {
    paddingHorizontal: 12,
  },
  listItem: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    overflow: 'hidden',
  },
  listItemLeft: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  sn: {
    width: 34,
    // fontSize: 12,
    textAlign: 'center',
    // backgroundColor: 'rgba(0,0,0,0.2)',
    paddingLeft: 3,
    paddingRight: 3,
  },
  itemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 2,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
  // listItemTitle: {
  //   // backgroundColor: 'rgba(0,0,0,0.2)',
  //   flexGrow: 0,
  //   flexShrink: 1,
  //   // fontSize: 15,
  // },
  listItemSingle: {
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    // alignItems: 'flex-end',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  listItemTimeLabel: {
    marginRight: 5,
    fontWeight: '400',
  },
  listItemSingleText: {
    // fontSize: 13,
    // paddingTop: 2,
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '300',
  },
  listItemBadge: {
    // fontSize: 10,
    paddingLeft: 5,
    paddingTop: 2,
    alignSelf: 'flex-start',
  },
  listItemRight: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    justifyContent: 'center',
  },
  moreButton: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingTitle: {
    fontWeight: '700',
  },
})

