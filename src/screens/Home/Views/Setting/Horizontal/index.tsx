import { View } from 'react-native'
import NavList from './NavList'
import SettingPages from '../Vertical'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { useTheme } from '@/store/theme/hook'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import { selectSettingSection } from '@/store/setting/navigation'

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
    borderTopWidth: BorderWidths.normal,
  },
  nav: {
    height: '100%',
    borderRightWidth: BorderWidths.normal,
  },
})

export default () => {
  const theme = useTheme()
  const { width, railWidth } = useAdaptiveLayout()

  return (
    <View style={{ ...styles.container, borderTopColor: theme['c-border-background'] }}>
      <View
        style={{
          ...styles.nav,
          width: Math.min(216, Math.max(144, (width - railWidth) * 0.22)),
          backgroundColor: theme['q-surface-base'],
          borderRightColor: theme['q-outline'],
        }}
      >
        <NavList onChangeId={selectSettingSection} />
      </View>
      <SettingPages compact={false} />
    </View>
  )
}
