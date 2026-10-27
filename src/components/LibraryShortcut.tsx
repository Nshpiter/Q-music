import { StyleSheet, View } from 'react-native'
import Button from './common/Button'
import Text from './common/Text'
import { Icon } from './common/Icon'
import { useTheme } from '@/store/theme/hook'

export default ({ icon, label, badge, accessibilityLabel = label, onPress }: {
  icon: string
  label: string
  badge?: string
  accessibilityLabel?: string
  onPress: () => void
}) => {
  const theme = useTheme()
  return <Button accessibilityLabel={accessibilityLabel} style={styles.button} onPress={onPress}>
    <View style={styles.icon}>
      <Icon accessible={false} name={icon} rawSize={24} color={theme['q-accent-text']} />
      {badge ? <View style={[styles.badge, { backgroundColor: theme['q-accent'] }]}><Text size={9} color={theme['q-on-accent']} numberOfLines={1}>{badge}</Text></View> : null}
    </View>
    <Text style={styles.label} size={12} color={theme['q-text-primary']} numberOfLines={2}>{label}</Text>
  </Button>
}

const styles = StyleSheet.create({
  // 卡片依赖内容撑高，不能用 flex: 1 把纵向测量基准归零，否则 Yoga 会低估外层高度。
  button: { flexShrink: 0, minWidth: 0, minHeight: 80, paddingHorizontal: 2, paddingVertical: 12, alignItems: 'center', justifyContent: 'flex-start', gap: 10, borderRadius: 12 },
  icon: { width: 30, height: 28, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center', alignSelf: 'stretch' },
  badge: { position: 'absolute', right: -12, top: -6, minWidth: 16, minHeight: 16, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
})
