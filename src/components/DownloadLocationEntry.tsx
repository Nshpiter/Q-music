import { StyleSheet, View } from 'react-native'
import Button from './common/Button'
import Text from './common/Text'
import { Icon } from './common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { getDownloadDirectory } from '@/core/download/location'
import { selectSettingSection } from '@/store/setting/navigation'
import { setNavActiveId } from '@/core/common'

export default ({ card = false }: { card?: boolean }) => {
  const t = useI18n()
  const theme = useTheme()
  useSettingValue('download.directory')
  return <Button pressScale={0.985} accessibilityLabel={t('download_directory')} style={[styles.entry, card && { ...styles.card, backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]} onPress={() => {
    selectSettingSection('download')
    setNavActiveId('nav_setting')
  }}>
    <Icon accessible={false} name="folder" rawSize={21} color={theme['q-accent-text']} />
    <View style={styles.label}>
      <Text size={14} style={card && { fontWeight: '600' }}>{t('download_directory')}</Text>
      <Text size={11} numberOfLines={1} ellipsizeMode="middle" color={theme['q-text-secondary']}>{getDownloadDirectory()}</Text>
    </View>
    <Icon accessible={false} name="chevron-right" rawSize={16} color={theme['q-text-secondary']} />
  </Button>
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', minHeight: 58, gap: 12, paddingHorizontal: 8, paddingVertical: 10 },
  card: { minHeight: 66, paddingHorizontal: 21, gap: 19, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  label: { flex: 1, minWidth: 0, gap: 4 },
})
