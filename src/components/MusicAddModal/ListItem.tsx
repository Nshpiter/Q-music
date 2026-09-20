import { View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useMusicExistsList } from '@/store/list/hook'
import { Q_UI } from '@/theme/ui'

export default ({ listInfo, onPress, musicInfo, width }: {
  listInfo: LX.List.MyListInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
  musicInfo: LX.Music.MusicInfo
  width: number
}) => {
  const theme = useTheme()
  const isExists = useMusicExistsList(listInfo, musicInfo)

  const handlePress = () => {
    if (isExists) {
      toast(global.i18n.t('list_add_tip_exists'))
      return
    }
    onPress(listInfo)
  }

  return (
    <View style={{ ...styles.listItem, width }}>
      <Button
        accessibilityLabel={listInfo.name}
        style={{ ...styles.button, backgroundColor: theme['q-surface-tint'], opacity: isExists ? 0.4 : 1 }}
        onPress={handlePress}
      >
        <Icon accessible={false} name="album" rawSize={20} color={theme['q-accent-text']} />
        <Text style={{ flex: 1 }} numberOfLines={1} size={14} color={theme['q-text-primary']}>{listInfo.name}</Text>
        <Icon accessible={false} name="chevron-right" rawSize={16} color={theme['q-text-secondary']} />
      </Button>
    </View>
  )
}

export const styles = createStyle({
  listItem: {
    // width: '50%',
    paddingRight: 13,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  button: {
    minHeight: Q_UI.touchSize,
    height: 56,
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 16,
    marginRight: 10,
    marginBottom: 10,
    borderRadius: Q_UI.radius.control,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
})
