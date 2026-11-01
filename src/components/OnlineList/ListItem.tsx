import { memo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Button, { type BtnType } from '@/components/common/Button'
import Text from '@/components/common/Text'
import Badge, { type BadgeType } from '@/components/common/Badge'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import { createStyle, type RowInfo } from '@/utils/tools'
import SourceLogo from '@/components/SourceLogo'
import Image from '@/components/common/Image'
import SongDownloadButton from '@/components/SongDownloadButton'

import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'

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
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const { songRowHeight, isCar } = useAdaptiveLayout()
  const playMusicInfo = usePlayMusicInfo()

  const isSelected = selectedList.includes(item)
  const isPlaying = playMusicInfo.musicInfo?.id == item.id

  const moreButtonRef = useRef<BtnType>(null)
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
    <View style={[styles.row, { width: rowInfo.rowWidth, height: songRowHeight }]} onLayout={event => { setMeasuredWidth(event.nativeEvent.layout.width) }}>
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
        <Button
          accessibilityLabel={`${item.name} · ${singer}`}
          accessibilityState={{ selected: isPlaying || isSelected }}
          style={styles.listItemLeft}
          onPress={() => { onPress(item, index) }}
          onLongPress={() => { onLongPress(item, index) }}
        >
          {
            isPlaying
              ? <Icon accessible={false} style={styles.sn} name="play-outline" size={13} color={theme['q-accent-text']} />
              : <Text style={styles.sn} size={13} color={theme['q-text-secondary']}>{index + 1}</Text>
          }
          <Image url={item.meta.picUrl} style={{ width: isCar ? 48 : 36, height: isCar ? 48 : 36, borderRadius: 7, marginRight: 10, flexShrink: 0 }} />
          <View style={styles.itemInfo}>
            <Text size={isCar ? 18 : 14} style={isPlaying ? styles.playingTitle : undefined} color={isPlaying ? theme['q-accent-text'] : theme['c-font']} numberOfLines={1}>{item.name}</Text>
            <View style={styles.listItemSingle}>
              { tagInfo.type ? <Badge type={tagInfo.type}>{tagInfo.text}</Badge> : null }
              { showSource ? <SourceLogo source={item.source} size={18} style={styles.sourceLogo} /> : null }
              <Text style={styles.listItemSingleText} size={isCar ? 13 : 11} color={theme['q-text-secondary']} numberOfLines={1}>{singer}</Text>
            </View>
          </View>
          {
            isShowInterval && measuredWidth >= 360 ? (
              <Text size={12} color={theme['q-text-secondary']} numberOfLines={1}>{item.interval}</Text>
            ) : null
          }
        </Button>
        {measuredWidth >= 480 ? <SongDownloadButton music={item} /> : null}
        <Button accessibilityLabel={`${item.name} · ${global.i18n.t('more_actions')}`} onPress={handleShowMenu} ref={moreButtonRef} style={[styles.moreButton, isCar && { width: 56, height: 64 }]}>
          <Icon accessible={false} name="dots-vertical" style={{ color: theme['q-text-secondary'] }} size={14} />
        </Button>
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
    width: 24,
    flexShrink: 0,
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
  sourceLogo: {
    marginRight: 6,
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
    width: 48,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingTitle: {
    fontWeight: '700',
  },
})

