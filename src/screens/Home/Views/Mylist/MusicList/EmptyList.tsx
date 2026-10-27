import { StyleSheet, View } from 'react-native'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { setNavActiveId } from '@/core/common'

export default () => {
  const theme = useTheme()
  const t = useI18n()
  return <View style={styles.empty}>
    <Icon name="album" rawSize={28} color={theme['q-text-secondary']} />
    <Text size={16} style={styles.title}>{t('mobile_library_empty')}</Text>
    <Text size={12} color={theme['q-text-secondary']} style={styles.hint}>{t('mobile_library_empty_hint')}</Text>
    <Button style={[styles.button, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]} onPress={() => { setNavActiveId('nav_search') }}>
      <Icon name="search-2" rawSize={16} color={theme['q-accent-text']} />
      <Text size={13} color={theme['q-accent-text']}>{t('library_search_songs')}</Text>
    </Button>
  </View>
}

const styles = StyleSheet.create({
  empty: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24, alignItems: 'center', gap: 10 },
  title: { fontWeight: '600', marginTop: 4, textAlign: 'center' },
  hint: { textAlign: 'center', lineHeight: 20 },
  button: { marginTop: 10, minHeight: 48, paddingHorizontal: 24, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
})
