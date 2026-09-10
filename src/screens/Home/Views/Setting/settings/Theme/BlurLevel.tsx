import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import type { QBlurLevel } from '@/theme/ui'

const setBlurLevel = (level: QBlurLevel) => {
  updateSetting({ 'theme.blurLevel': level })
}

const useActive = (id: QBlurLevel) => {
  const blurLevel = useSettingValue('theme.blurLevel')
  return useMemo(() => blurLevel == id, [blurLevel, id])
}

const Item = ({ id, name }: { id: QBlurLevel, name: string }) => {
  const isActive = useActive(id)
  return <CheckBox marginRight={8} check={isActive} label={name} onChange={() => { setBlurLevel(id) }} need />
}

export default memo(() => {
  const t = useI18n()

  return (
    <SubTitle title={t('setting_basic_theme_blur_level')}>
      <View style={styles.list}>
        <Item id="clear" name={t('setting_basic_theme_blur_level_clear')} />
        <Item id="balance" name={t('setting_basic_theme_blur_level_balance')} />
        <Item id="immersive" name={t('setting_basic_theme_blur_level_immersive')} />
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
