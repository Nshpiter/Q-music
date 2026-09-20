import { StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { setActiveList } from '@/core/list'
import { setNavActiveId } from '@/core/common'
import { LIST_IDS } from '@/config/constant'
import { pushMusicAccountScreen } from '@/navigation/navigation'
import commonState from '@/store/common/state'

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const items = [
    { icon: 'love', label: 'list_name_love', action: () => { setActiveList(LIST_IDS.LOVE) } },
    { icon: 'download-2', label: 'download', action: () => { setNavActiveId('download') } },
    { icon: 'album', label: 'mobile_playlists', action: () => { global.app_event.changeLoveListVisible(true) } },
    { icon: 'available_updates', label: 'account_lists_entry', action: () => { if (commonState.componentIds.home) pushMusicAccountScreen(commonState.componentIds.home) } },
  ] as const
  return (
    <View style={styles.container}>
      {items.map(item => (
        <Button key={item.label} accessibilityLabel={t(item.label)} style={styles.item} onPress={item.action}>
          <View style={{ ...styles.icon, backgroundColor: theme['q-surface-tint'] }}><Icon accessible={false} name={item.icon} rawSize={23} color={theme['q-accent-text']} /></View>
          <Text size={12} color={theme['q-text-primary']} numberOfLines={1}>{t(item.label)}</Text>
        </Button>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 4, padding: 16 },
  item: { flex: 1, minHeight: 80, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 10 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
})
