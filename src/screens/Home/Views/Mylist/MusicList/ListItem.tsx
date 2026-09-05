import { memo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
// import { BorderWidths } from '@/theme'
import { Icon } from '@/components/common/Icon'
import { createStyle, type RowInfo } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useAssertApiSupport } from '@/store/common/hook'
import Text from '@/components/common/Text'
import SourceLogo from '@/components/SourceLogo'
import Button, { type BtnType } from '@/components/common/Button'

export const ITEM_HEIGHT = 54


export default memo(({ item, index, activeIndex, onPress, onShowMenu, onLongPress, selectedList, rowInfo, isShowAlbumName, isShowInterval }: {
  item: LX.Music.MusicInfo
  index: number
  activeIndex: number
  onPress: (item: LX.Music.MusicInfo, index: number) => void
  onLongPress: (item: LX.Music.MusicInfo, index: number) => void
  onShowMenu: (item: LX.Music.MusicInfo, index: number, position: { x: number, y: number, w: number, h: number }) => void
  selectedList: LX.Music.MusicInfo[]
  rowInfo: RowInfo
  isShowAlbumName: boolean
  isShowInterval: boolean
}) => {
  const theme = useTheme()

  const isSelected = selectedList.includes(item)
  // console.log(item.name, selectedList, selectedList.includes(item))
  const isSupported = useAssertApiSupport(item.source)
  const moreButtonRef = useRef<BtnType>(null)
  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        // console.log(fx, fy, width, height, px, py)
        onShowMenu(item, index, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }
  const active = activeIndex == index

  const singer = `${item.singer}${isShowAlbumName && item.meta.albumName ? ` · ${item.meta.albumName}` : ''}`

  return (
    <View style={[styles.row, { width: rowInfo.rowWidth, height: ITEM_HEIGHT, opacity: isSupported ? 1 : 0.5 }]}>
      <View style={[
        styles.listItem,
        active
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
          accessibilityState={{ selected: active || isSelected }}
          style={styles.listItemLeft}
          onPress={() => { onPress(item, index) }}
          onLongPress={() => { onLongPress(item, index) }}
        >
          {
            active
              ? <Icon accessible={false} style={styles.sn} name="play-outline" size={13} color={theme['q-accent-text']} />
              : <Text style={styles.sn} size={13} color={theme['q-text-secondary']}>{index + 1}</Text>
          }
          <View style={styles.itemInfo}>
            <Text style={active ? styles.playingTitle : undefined} color={active ? theme['q-accent-text'] : theme['c-font']} numberOfLines={1}>{item.name}</Text>
            <View style={styles.listItemSingle}>
              {item.source != 'local' ? <SourceLogo source={item.source} size={18} style={styles.sourceLogo} /> : null}
              <Text style={styles.listItemSingleText} size={11} color={theme['q-text-secondary']} numberOfLines={1}>
                {singer}
              </Text>
            </View>
          </View>
          {
            isShowInterval ? (
              <Text size={12} color={theme['q-text-secondary']} numberOfLines={1}>{item.interval}</Text>
            ) : null
          }
        </Button>
        <Button accessibilityLabel={`${item.name} · ${global.i18n.t('more_actions')}`} onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton}>
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
    prevProps.activeIndex != nextProps.index &&
    nextProps.activeIndex != nextProps.index &&
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
    // paddingTop: 10,
    // paddingBottom: 10,
    paddingRight: 2,
  },
  playingTitle: {
    fontWeight: '700',
  },
  // listItemTitle: {
  //   flexGrow: 0,
  //   flexShrink: 1,
  // },
  listItemSingle: {
    paddingTop: 3,
    flexDirection: 'row',
    // alignItems: 'flex-end',
  },
  listItemSingleText: {
    // backgroundColor: 'rgba(0,0,0,0.2)',
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '300',
    // fontSize: 15,
  },
  sourceLogo: {
    marginRight: 6,
  },
  // listItemBadge: {
  //   // fontSize: 10,
  //   paddingLeft: 5,
  //   paddingTop: 2,
  //   alignSelf: 'flex-start',
  // },
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
})
