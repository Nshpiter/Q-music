import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { StyleSheet } from 'react-native'
import Text from '@/components/common/Text'

export const BTN_WIDTH = 48
export const BTN_ICON_SIZE = 20

export default ({ icon, color, onPress, onLongPress, accessibilityLabel, selected, label }: {
  icon: string
  color?: string
  onPress: () => void
  onLongPress?: () => void
  accessibilityLabel: string
  selected?: boolean
  label?: string
}) => {
  const theme = useTheme()
  return <Button
    accessibilityLabel={accessibilityLabel}
    accessibilityState={selected == null ? undefined : { selected }}
    onPress={onPress}
    onLongPress={onLongPress}
    ripple={null}
    style={styles.button}
  >
    <Icon accessible={false} name={icon} rawSize={BTN_ICON_SIZE} color={color ?? (selected ? theme['q-accent-text'] : theme['q-text-secondary'])} />
    {label ? <Text accessible={false} size={10} color={theme['q-text-secondary']} style={styles.label}>{label}</Text> : null}
  </Button>
}

const styles = StyleSheet.create({
  button: { minWidth: 48, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  label: { marginLeft: 6 },
})
