import { View } from 'react-native'
import Button from '@/components/common/Button'
import PlaylistIdentity, { getPlaylistLabel } from '@/components/PlaylistIdentity'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useMusicExistsList } from '@/store/list/hook'
import { Q_UI } from '@/theme/ui'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'

export default ({ listInfo, onPress, musicInfo, disabled = false }: {
  listInfo: LX.List.MyListInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
  musicInfo: LX.Music.MusicInfo
  disabled?: boolean
}) => {
  const theme = useTheme()
  const t = useI18n()
  const isExists = useMusicExistsList(listInfo, musicInfo)

  const handlePress = () => {
    if (disabled || isExists) return
    onPress(listInfo)
  }

  const content = <>
    <PlaylistIdentity list={listInfo} subtitle localCopy />
    {isExists ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon accessible={false} name="check" rawSize={14} color={theme['q-accent-text']} />
      <Text size={11} color={theme['q-accent-text']}>{t('favorite_local_exists')}</Text>
    </View> : <Icon accessible={false} name="add" rawSize={16} color={theme['q-text-secondary']} />}
  </>
  const rowStyle = { ...styles.button, backgroundColor: theme['q-surface-raised'], borderWidth: 0.5, borderColor: theme['q-outline'] }
  return isExists
    ? <View accessible accessibilityLabel={`${getPlaylistLabel(listInfo)}，${t('favorite_local_exists')}`} accessibilityState={{ disabled: true }} style={rowStyle}>{content}</View>
    : (
      <Button
        accessibilityLabel={getPlaylistLabel(listInfo)}
        disabled={disabled}
        style={rowStyle}
        onPress={handlePress}
      >
        {content}
      </Button>
      )
}

export const styles = createStyle({
  button: {
    minHeight: 56,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: Q_UI.radius.control,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
})
