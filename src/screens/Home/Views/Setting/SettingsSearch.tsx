import { Keyboard, StyleSheet, View } from 'react-native'
import Input from '@/components/common/Input'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { selectSettingSection } from '@/store/setting/navigation'
import { SETTINGS_SEARCH_ITEMS } from './searchItems'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import { matchSettings } from './searchMatch'

export default ({ query, onChange }: { query: string, onChange: (value: string) => void }) => {
  const theme = useTheme()
  const t = useI18n()
  const { wide, isCar } = useAdaptiveLayout()
  const results = matchSettings(query, SETTINGS_SEARCH_ITEMS.filter(item => !item.largeScreenOnly || wide || isCar), t)
  return <View style={styles.container}>
    <Input accessibilityLabel={t('settings_search')} placeholder={t('settings_search_placeholder')} value={query} onChangeText={onChange} clearBtn clearButtonAccessibilityLabel={t('settings_search_clear')} returnKeyType="search" onSubmitEditing={() => { Keyboard.dismiss() }} autoCorrect={false} />
    {query.trim() ? <View>
      <Text accessibilityLiveRegion="polite" size={12} color={theme['q-text-secondary']} style={styles.summary}>{results.length ? t('settings_search_count', { count: results.length }) : t('settings_search_empty')}</Text>
      {results.map(item => <Button key={item.id} pressScale={0.985} style={[styles.result, { borderBottomColor: theme['q-outline'] }]} onPress={() => {
        Keyboard.dismiss()
        selectSettingSection(item.section, item.id)
      }}>
        <View style={styles.label}>
          <Text size={14}>{t(item.title)}</Text>
          <Text size={11} color={theme['q-text-secondary']}>{t(`setting_${item.section}`)}</Text>
        </View>
        <Icon accessible={false} name="chevron-right" rawSize={16} color={theme['q-text-secondary']} />
      </Button>)}
    </View> : null}
  </View>
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  summary: { paddingHorizontal: 4, paddingTop: 18, paddingBottom: 6, lineHeight: 20 },
  result: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { flex: 1, minWidth: 0, gap: 5 },
})
