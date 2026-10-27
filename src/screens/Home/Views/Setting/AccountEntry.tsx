import { StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { pushMusicAccountScreen } from '@/navigation/navigation'
import commonState from '@/store/common/state'

export default () => {
  const theme = useTheme()
  const t = useI18n()
  return <Button pressScale={0.985} style={[styles.account, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]} onPress={() => {
    if (commonState.componentIds.home) pushMusicAccountScreen(commonState.componentIds.home)
  }}>
    <Icon accessible={false} name="user" rawSize={21} color={theme['q-accent-text']} />
    <View style={styles.label}>
      <Text size={14} style={{ fontWeight: '600' }}>{t('setting_accounts_entry')}</Text>
      <Text size={11} color={theme['q-text-secondary']}>{t('setting_accounts_summary')}</Text>
    </View>
    <Icon accessible={false} name="chevron-right" rawSize={17} color={theme['q-text-secondary']} />
  </Button>
}

const styles = StyleSheet.create({
  account: { minHeight: 66, paddingHorizontal: 21, paddingVertical: 12, gap: 19, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1, minWidth: 0, gap: 3 },
})
