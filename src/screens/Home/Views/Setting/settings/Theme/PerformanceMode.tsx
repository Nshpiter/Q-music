import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'

export default memo(() => {
  const t = useI18n()
  const performanceMode = useSettingValue('theme.performanceMode')

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={performanceMode}
        label={t('setting_basic_theme_performance_mode')}
        onChange={value => { updateSetting({ 'theme.performanceMode': value }) }}
      />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
