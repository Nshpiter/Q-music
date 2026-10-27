import { View } from 'react-native'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useInteractionMotion } from '@/utils/useMotion'
import CheckBoxItem from '../../components/CheckBoxItem'

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const enabled = useSettingValue('common.predictiveBack')
  const motion = useInteractionMotion()
  return <View style={{ marginTop: 12 }}>
    <CheckBoxItem check={enabled} onChange={value => { updateSetting({ 'common.predictiveBack': value }) }} label={t('setting_predictive_back')} />
    <Text size={12} color={theme['q-text-secondary']} style={{ paddingHorizontal: 10, paddingBottom: 8, lineHeight: 19 }}>{t('setting_predictive_back_tip')}</Text>
    {enabled && !motion ? <Text accessibilityLiveRegion="polite" size={12} color={theme['q-text-secondary']} style={{ paddingHorizontal: 10, paddingBottom: 8, lineHeight: 19 }}>{t('setting_predictive_back_reduced')}</Text> : null}
  </View>
}
