import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import CheckBoxItem from '../../components/CheckBoxItem'

export default () => {
  const t = useI18n()
  const mode = useSettingValue('list.singlePlayMode')
  const allMode = useSettingValue('list.playAllMode')
  const preferLocal = useSettingValue('player.preferLocal')
  return <View style={{ marginTop: 12 }}>
    <Text size={14}>{t('setting_single_play')}</Text>
    {(['replace', 'add'] as const).map(value => <CheckBoxItem key={value} check={mode == value} label={t(value == 'replace' ? 'setting_single_play_replace' : 'setting_single_play_add')} onChange={() => { updateSetting({ 'list.singlePlayMode': value }) }} />)}
    <Text size={12}>{t('setting_single_play_tip')}</Text>
    <Text size={14} style={{ marginTop: 16 }}>{t('queue_play_all_mode')}</Text>
    {(['replace', 'append'] as const).map(value => <CheckBoxItem key={value} check={allMode == value} label={t(value == 'replace' ? 'queue_play_all_replace' : 'queue_play_all_append')} onChange={() => { updateSetting({ 'list.playAllMode': value }) }} />)}
    <CheckBoxItem check={preferLocal} label={t('setting_prefer_local')} onChange={enabled => { updateSetting({ 'player.preferLocal': enabled }) }} />
    <Text size={12}>{t('setting_prefer_local_tip')}</Text>
  </View>
}
