import { memo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Button, { type BtnType } from '@/components/common/Button'
import Text from '@/components/common/Text'
import Badge, { type BadgeType } from '@/components/common/Badge'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import { Q_UI } from '@/theme/ui'
import { createStyle, type RowInfo } from '@/utils/tools'
import SourceLogo from '@/components/SourceLogo'
import TrackArtwork from '@/components/TrackArtwork'
import SongDownloadButton from '@/components/SongDownloadButton'
import BilibiliPartsButton from '@/components/BilibiliPartsButton'

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

export default memo(({ item, index, showSource, isMultiSelectMode, rowHeight, onPress, onLongPress, onShowMenu, selectedList, rowInfo, isShowAlbumName, isShowInterval }: {
  item: LX.Music.MusicInfoOnline
  index: number
  showSource?: boolean
  isMultiSelectMode: boolean
  rowHeight: number
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
  const { isCar } = useAdaptiveLayout()
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

  const singer = `${item.singer}${isShowAlbumName && item.meta.albumName && item.source != 'bi' ? ` · ${item.meta.albumName}` : ''}`

  return (
    <View style={[styles.row, { width: rowInfo.rowWidth, height: rowHeight }]} onLayout={event => { setMeasuredWidth(event.nativeEvent.layout.width) }}>
      <View style={[
        styles.listItem,
        isPlaying
          ? {
              backgroundColor: theme['q-surface-tint'],
              borderColor: theme['c-primary-alpha-700'],
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: Q_UI.radius.item,
            }
          : isSelected
            ? {
                backgroundColor: theme['c-primary-light-300-alpha-800'],
                borderRadius: Q_UI.radius.item,
              }
            : {
                backgroundColor: 'transparent',
                borderBottomColor: theme.isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(40, 50, 66, 0.06)',
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
      ]}>
        <Button
          accessibilityLabel={`${item.name} · ${singer}`}
          accessibilityRole={isMultiSelectMode ? 'checkbox' : 'button'}
          accessibilityState={isMultiSelectMode ? { checked: isSelected } : { selected: isPlaying }}
          style={styles.listItemLeft}
          onPress={() => { onPress(item, index) }}
          onLongPress={() => { onLongPress(item, index) }}
        >
          {
            isMultiSelectMode
              ? <View style={styles.sn}>
                  <View style={[styles.selection, { backgroundColor: isSelected ? theme['q-accent'] : 'transparent', borderColor: isSelected ? theme['q-accent'] : theme['q-outline'] }]}>
                    {isSelected ? <Icon accessible={false} name="check" rawSize={13} color={theme['q-on-accent']} /> : null}
                  </View>
                </View>
              : isPlaying
                ? <Icon accessible={false} style={styles.sn} name="play-outline" size={13} color={theme['q-accent-text']} />
                : <Text style={styles.sn} size={12} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} color={theme['q-text-secondary']}>{index + 1}</Text>
          }
          <TrackArtwork item={item} style={{ width: isCar ? 48 : 36, height: isCar ? 48 : 36, borderRadius: 7, marginRight: 10, flexShrink: 0 }} />
          <View style={styles.itemInfo}>
            <Text size={isCar ? 18 : 14} style={isPlaying ? styles.playingTitle : undefined} color={isPlaying ? theme['q-accent-text'] : theme['c-font']} numberOfLines={item.source == 'bi' ? 2 : 1}>{item.name}</Text>
            <View style={styles.listItemSingle}>
              { tagInfo.type ? <Badge type={tagInfo.type}>{tagInfo.text}</Badge> : null }
              { showSource ? <SourceLogo source={item.source} size={18} style={styles.sourceLogo} /> : null }
              <Text style={styles.listItemSingleText} size={isCar ? 13 : 11} color={theme['q-text-secondary']} numberOfLines={1}>{singer}</Text>
            </View>
          </View>
          {
            isShowInterval && measuredWidth >= 360 && item.source != 'bi' ? (
              <Text size={12} color={theme['q-text-secondary']} numberOfLines={1}>{item.interval}</Text>
            ) : null
          }
        </Button>
        {!isMultiSelectMode && item.source == 'bi' ? <BilibiliPartsButton music={item} /> : null}
        {!isMultiSelectMode && measuredWidth >= 480 ? <SongDownloadButton music={item} /> : null}
        <Button accessibilityLabel={`${item.name} · ${global.i18n.t('more_actions')}`} onPress={handleShowMenu} ref={moreButtonRef} style={[styles.moreButton, isCar && { width: 56, height: 64 }]}>
          <Icon accessible={false} name="dots-vertical" style={{ color: theme['q-text-secondary'] }} size={14} />
        </Button>
      </View>
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index &&
    prevProps.showSource === nextProps.showSource &&
    prevProps.isMultiSelectMode === nextProps.isMultiSelectMode &&
    prevProps.rowHeight === nextProps.rowHeight &&
    prevProps.rowInfo.rowWidth === nextProps.rowInfo.rowWidth &&
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
    borderRadius: Q_UI.radius.item,
  },
  listItemLeft: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 2,
  },
  sn: {
    width: 26,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    paddingLeft: 1,
    paddingRight: 1,
    fontVariant: ['tabular-nums'],
  },
  itemInfo: {
    minWidth: 0,
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
    flexShrink: 0,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingTitle: {
    fontWeight: '700',
  },
  selection: { width: 20, height: 20, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
})

