import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'


import CheckBoxItem from '../../components/CheckBoxItem'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'

export default memo(() => {
  const t = useI18n()
  const homePageScroll = useSettingValue('common.homePageScroll')
  const { canSwipePages } = useAdaptiveLayout()
  const setHomePageScroll = (homePageScroll: boolean) => {
    updateSetting({ 'common.homePageScroll': homePageScroll })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={canSwipePages && homePageScroll} disabled={!canSwipePages} label={t('setting_basic_home_page_scroll')} helpDesc={!canSwipePages ? t('setting_side_navigation_tip') : undefined} onChange={setHomePageScroll} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
