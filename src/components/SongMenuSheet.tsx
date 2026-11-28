import { ScrollView, StyleSheet, View } from 'react-native'
import BottomSheet from '@/components/common/BottomSheet'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import TrackArtwork from '@/components/TrackArtwork'
import SourceLogo from '@/components/SourceLogo'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'

export interface SongMenuActionItem {
  action: string
  label: string
  icon: string
  disabled?: boolean
  danger?: boolean
}

export interface SongMenuSheetProps {
  visible: boolean
  musicInfo: LX.Music.MusicInfo | null
  menus: readonly SongMenuActionItem[]
  onClose: () => void
  onClosed?: () => void
  onSelect: (action: SongMenuActionItem) => void
}

/**
 * 统一的安卓列表歌曲底部操作菜单，确保搜索、歌单与播放历史共用一致的操作层次与视觉表现。
 */
export default ({ visible, musicInfo, menus, onClose, onClosed, onSelect }: SongMenuSheetProps) => {
  const theme = useTheme()
  const t = useI18n()
  const maxHeight = Math.min(540, 170 + menus.length * 54)

  return (
    <BottomSheet visible={visible && !!musicInfo} maxHeight={maxHeight} onClose={onClose} onClosed={onClosed} testID="song-menu-sheet">
      {musicInfo ? (
        <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
          <View style={[styles.header, { borderBottomColor: theme['q-outline'] }]}>
            <View style={[styles.coverWrap, { backgroundColor: theme['q-surface-tint'] }]}>
              <TrackArtwork item={musicInfo} style={styles.cover} />
            </View>
            <View style={styles.meta}>
              <Text size={15} style={styles.title} color={theme['q-text-primary']} numberOfLines={1}>{musicInfo.name}</Text>
              <View style={styles.subRow}>
                {musicInfo.source != 'local' ? <SourceLogo source={musicInfo.source} size={13} /> : null}
                <Text size={12} color={theme['q-text-secondary']} numberOfLines={1} style={styles.subText}>
                  {musicInfo.singer}{musicInfo.meta.albumName ? ` · ${musicInfo.meta.albumName}` : ''}
                </Text>
              </View>
            </View>
            <Button accessibilityLabel={t('close')} onPress={onClose} style={styles.closeBtn}>
              <Icon accessible={false} name="close" rawSize={18} color={theme['q-text-secondary']} />
            </Button>
          </View>
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {menus.map(item => (
              <Button
                key={item.action}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                accessibilityState={{ disabled: !!item.disabled }}
                disabled={item.disabled}
                pressScale={0.985}
                style={styles.row}
                onPress={() => {
                  onClose()
                  onSelect(item)
                }}
              >
                <View style={[styles.rowIcon, { backgroundColor: item.danger ? 'transparent' : theme['q-surface-tint'] }]}>
                  <Icon
                    accessible={false}
                    name={item.icon}
                    rawSize={18}
                    color={item.danger ? theme['c-badge-tertiary'] : theme['q-accent-text']}
                  />
                </View>
                <Text
                  size={15}
                  style={styles.rowLabel}
                  color={item.danger ? theme['c-badge-tertiary'] : theme['q-text-primary']}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <Icon accessible={false} name="chevron-right" rawSize={15} color={theme['q-text-secondary']} />
              </Button>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  coverWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontWeight: '600',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  subText: {
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 2,
  },
  row: {
    minHeight: 50,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
    fontWeight: '500',
  },
})
