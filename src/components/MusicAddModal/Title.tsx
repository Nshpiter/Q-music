import { View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import SourceLogo from '@/components/SourceLogo'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'

export default ({ musicInfo, isMove }: {
  musicInfo: LX.Music.MusicInfo
  isMove: boolean
}) => {
  const theme = useTheme()
  const t = useI18n()
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 }}>
      {musicInfo.source == 'local' ? <Icon name="album" rawSize={32} color={theme['q-text-secondary']} /> : <SourceLogo source={musicInfo.source} size={36} />}
      <View style={{ flex: 1, gap: 5 }}>
        <Text size={15} numberOfLines={2} style={{ fontWeight: '600' }}>{musicInfo.name}</Text>
        <Text size={12} numberOfLines={1} color={theme['q-text-secondary']}>{isMove ? t('list_add_title_first_move') + ' · ' : ''}{musicInfo.singer || '—'}</Text>
      </View>
    </View>
  )
}
