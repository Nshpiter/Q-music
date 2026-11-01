import { View } from 'react-native'
import SourceLogo, { SOURCE_LOGOS } from './SourceLogo'
import { Icon } from './common/Icon'
import Text from './common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'

export const getPlaylistSource = (list: LX.List.MyListInfo) => 'source' in list ? list.source : undefined
export const getPlaylistLabel = (list: LX.List.MyListInfo) => {
  const source = getPlaylistSource(list)
  return source ? `${list.name}，${SOURCE_LOGOS[source]?.label ?? source}` : list.name
}

export default ({ list, name, subtitle = false, active = false, localCopy = false }: {
  list: LX.List.MyListInfo
  name?: string
  subtitle?: boolean
  active?: boolean
  localCopy?: boolean
}) => {
  const theme = useTheme()
  const t = useI18n()
  const source = getPlaylistSource(list)
  const label = source ? SOURCE_LOGOS[source]?.label ?? source : t('playlist_local')
  return <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    {source ? <SourceLogo source={source} size={24} /> : <View style={{ width: 24, alignItems: 'center' }}><Icon name={list.id == 'love' ? 'love' : 'album'} size={20} color={theme['q-text-secondary']} /></View>}
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <Text numberOfLines={1} size={14} color={theme[active ? 'q-accent-text' : 'q-text-primary']} style={{ fontWeight: active ? '600' : '400' }}>{name ?? list.name}</Text>
      {subtitle ? <Text numberOfLines={1} size={11} color={theme['q-text-secondary']}>{localCopy && source ? t('favorite_local_copy', { source: label }) : label}</Text> : null}
    </View>
  </View>
}
