import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useMyList } from '@/store/list/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { getFavoriteListId } from '@/core/localFavorite'
import CheckBoxItem from '../../components/CheckBoxItem'

export default () => {
  const t = useI18n()
  const lists = useMyList()
  useSettingValue('list.favoriteTargetId')
  const id = getFavoriteListId()
  return <View style={{ marginTop: 16 }}>
    <Text size={14}>{t('favorite_default_target')}</Text>
    {lists.filter(list => !('source' in list) || !list.source).map(list => <CheckBoxItem key={list.id} check={list.id == id} label={list.name} onChange={() => { updateSetting({ 'list.favoriteTargetId': list.id }) }} />)}
    <Text size={12}>{t('favorite_default_tip')}</Text>
  </View>
}
