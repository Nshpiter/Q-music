import { forwardRef, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Button from '@/components/common/Button'
import { BorderWidths } from '@/theme'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { type SettingScreenIds } from '../Main'

export interface HeaderProps {
  onShowNavBar: () => void
}
export interface HeaderType {
  setActiveId: (id: SettingScreenIds) => void
}

export default forwardRef<HeaderType, HeaderProps>(({ onShowNavBar }, ref) => {
  const [activeId, setActiveId] = useState(global.lx.settingActiveId)
  const theme = useTheme()
  const t = useI18n()

  useImperativeHandle(ref, () => ({
    setActiveId(id) {
      setActiveId(id)
    },
  }))

  return (
    <Button
      accessibilityLabel={t(`setting_${activeId}`)}
      accessibilityHint={t('setting_open_nav') || undefined}
      onPress={onShowNavBar}
      style={{ ...styles.currentList, borderBottomColor: theme['c-border-background'] }}
    >
      <View style={styles.currentListIcon}>
        <Icon accessible={false} color={theme['c-button-font']} name="chevron-right" size={12} />
      </View>
      <Text numberOfLines={1} size={16} style={styles.currentListText} color={theme['c-button-font']}>{t(`setting_${activeId}`)}</Text>
    </Button>
  )
})


const styles = createStyle({
  currentList: {
    flexDirection: 'row',
    paddingRight: 2,
    minHeight: 48,
    height: 48,
    alignItems: 'center',
    borderBottomWidth: BorderWidths.normal,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  currentListIcon: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    // paddingTop: 10,
    // paddingBottom: 0,
  },
  currentListText: {
    flex: 1,
    // minWidth: 70,
    // paddingLeft: 10,
    paddingRight: 10,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
})
