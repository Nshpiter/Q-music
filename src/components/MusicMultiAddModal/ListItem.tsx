import { View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { BorderWidths } from '@/theme'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { Q_UI } from '@/theme/ui'

export default ({ listInfo, onPress, width }: {
  listInfo: LX.List.MyListInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
  width: number
}) => {
  const theme = useTheme()

  const handlePress = () => {
    onPress(listInfo)
  }

  return (
    <View style={{ ...styles.listItem, width }}>
      <Button
        accessibilityLabel={listInfo.name}
        style={{ ...styles.button, backgroundColor: theme['c-button-background'], borderColor: theme['c-primary-light-200-alpha-700'] }}
        onPress={handlePress}
      >
        <Text numberOfLines={1} size={14} color={theme['c-button-font']}>{listInfo.name}</Text>
      </Button>
    </View>
  )
}

export const styles = createStyle({
  listItem: {
    // width: '50%',
    paddingRight: 13,
  },
  button: {
    minHeight: Q_UI.touchSize,
    height: Q_UI.touchSize,
    paddingLeft: 10,
    paddingRight: 10,
    marginRight: 10,
    marginBottom: 10,
    borderRadius: Q_UI.radius.control,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BorderWidths.normal1,
  },
})
