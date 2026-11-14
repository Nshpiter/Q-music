import { ActivityIndicator, StyleSheet, View } from 'react-native'
import Button from './Button'
import Text from './Text'
import { Icon } from './Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { Q_UI } from '@/theme/ui'

export type FooterLabel = 'list_loading' | 'list_end' | 'list_error' | null

export default ({ label, onLoadMore }: { label: FooterLabel, onLoadMore: () => void }) => {
  const theme = useTheme()
  const t = useI18n()
  if (!label) return null
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {label == 'list_error'
        ? <Button style={[styles.retry, { backgroundColor: theme['q-surface-tint'] }]} onPress={onLoadMore}>
            <Icon accessible={false} name="available_updates" size={16} color={theme['q-accent-text']} />
            <Text size={13} color={theme['q-accent-text']} style={styles.label}>{t(label)}</Text>
          </Button>
        : <View style={styles.status}>
            {label == 'list_loading' ? <ActivityIndicator size="small" color={theme['q-accent']} /> : null}
            <Text size={12} color={theme['q-text-secondary']} style={styles.label}>{t(label)}</Text>
          </View>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  status: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8 },
  retry: { minHeight: Q_UI.touchSize, maxWidth: '100%', paddingHorizontal: 18, paddingVertical: 10, borderRadius: Q_UI.radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { flexShrink: 1, textAlign: 'center' },
})
