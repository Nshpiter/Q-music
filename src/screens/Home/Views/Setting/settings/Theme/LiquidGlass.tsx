import { View } from 'react-native'
import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const enabled = useSettingValue('theme.liquidGlass')
  const performanceMode = useSettingValue('theme.performanceMode')
  return <View style={{ marginTop: 8 }}>
    <CheckBoxItem check={enabled} label={t('setting_liquid_glass')} onChange={value => { updateSetting({ 'theme.liquidGlass': value }) }} />
    <Text size={12} color={theme['q-text-secondary']} style={{ marginHorizontal: 16, marginTop: 6, lineHeight: 19 }}>{t(performanceMode && enabled ? 'setting_liquid_glass_paused' : 'setting_liquid_glass_tip')}</Text>
  </View>
}
