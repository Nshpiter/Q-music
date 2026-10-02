import { View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { styles } from '../MusicAddModal/ListItem'

export default ({ listInfo, onPress, disabled = false }: {
  listInfo: LX.List.MyListInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
  disabled?: boolean
}) => {
  const theme = useTheme()

  const handlePress = () => {
    if (!disabled) onPress(listInfo)
  }

  return (
    <View>
      <Button
        accessibilityLabel={listInfo.name}
        disabled={disabled}
        style={{ ...styles.button, backgroundColor: theme['q-surface-tint'] }}
        onPress={handlePress}
      >
        <Icon accessible={false} name="album" rawSize={20} color={theme['q-accent-text']} />
        <Text style={{ flex: 1 }} numberOfLines={1} size={14} color={theme['q-text-primary']}>{listInfo.name}</Text>
        <Icon accessible={false} name="chevron-right" rawSize={16} color={theme['q-text-secondary']} />
      </Button>
    </View>
  )
}
