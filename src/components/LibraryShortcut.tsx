import { StyleSheet, View } from 'react-native'
import Button from './common/Button'
import Text from './common/Text'
import { Icon } from './common/Icon'
import { useTheme } from '@/store/theme/hook'

export default ({ icon, label, badge, variant = 'tile', accessibilityLabel = label, onPress }: {
  icon: string
  label: string
  badge?: string
  variant?: 'tile' | 'row'
  accessibilityLabel?: string
  onPress: () => void
}) => {
  const theme = useTheme()
  if (variant == 'row') {
    return <Button
      accessibilityLabel={accessibilityLabel}
      pressScale={0.97}
      style={[styles.rowButton, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme['q-surface-tint'] }]}>
        <Icon accessible={false} name={icon} rawSize={18} color={theme['q-accent-text']} />
      </View>
      <Text style={styles.rowLabel} size={12} color={theme['q-text-primary']} numberOfLines={1}>{label}</Text>
      <Icon accessible={false} name="chevron-right" rawSize={14} color={theme['q-text-secondary']} />
    </Button>
  }
  return <Button accessibilityLabel={accessibilityLabel} pressScale={0.96} style={styles.button} onPress={onPress}>
    <View style={[styles.icon, { backgroundColor: theme['q-surface-tint'] }]}>
      <Icon accessible={false} name={icon} rawSize={20} color={theme['q-accent-text']} />
      {badge ? <View style={[styles.badge, { backgroundColor: theme['q-accent'] }]}><Text size={9} color={theme['q-on-accent']} numberOfLines={1}>{badge}</Text></View> : null}
    </View>
    <Text style={styles.label} size={12} color={theme['q-text-primary']} numberOfLines={1}>{label}</Text>
  </Button>
}

const styles = StyleSheet.create({
  // 卡片依赖内容撑高，不能用 flex: 1 把纵向测量基准归零，否则 Yoga 会低估外层高度。
  button: { flexShrink: 0, minWidth: 0, minHeight: 82, paddingHorizontal: 4, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, overflow: 'hidden' },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center', alignSelf: 'stretch', fontWeight: '500' },
  badge: { position: 'absolute', right: -5, top: -4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowButton: { flexShrink: 0, minWidth: 0, minHeight: 54, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden' },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowLabel: { flex: 1, minWidth: 0, fontWeight: '500' },
})
