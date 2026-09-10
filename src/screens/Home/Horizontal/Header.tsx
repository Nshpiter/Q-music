import { View } from 'react-native'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { useSettingValue } from '@/store/setting/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import { type InitState as CommonState } from '@/store/common/state'
import SearchTypeSelector from '@/screens/Home/Views/Search/SearchTypeSelector'
import { useTheme } from '@/store/theme/hook'

const headerComponents: Partial<Record<CommonState['navActiveId'], React.ReactNode>> = {
  nav_search: <SearchTypeSelector />,
}

const HEADER_CONTENT_HEIGHT = Math.max(scaleSizeH(54), 54)

export default () => {
  const theme = useTheme()
  const id = useNavActiveId()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const drawerPosition = useSettingValue('common.drawerLayoutPosition')

  return (
    <>
      <StatusBar />
      <View
        style={{
          ...styles.safeArea,
          paddingTop: statusBarHeight,
          backgroundColor: theme['q-surface-raised'],
          borderBottomColor: theme['q-outline'],
        }}
      >
        <View style={{ ...styles.container, height: HEADER_CONTENT_HEIGHT }}>
          <Text
            style={{
              ...styles.title,
              textAlign: drawerPosition == 'left' ? 'left' : 'right',
            }}
            size={18}
            color={theme['q-text-primary']}
            numberOfLines={1}
          >
            {t(id)}
          </Text>
          {headerComponents[id] ?? null}
        </View>
      </View>
    </>
  )
}

const styles = createStyle({
  safeArea: {
    zIndex: 10,
    borderBottomWidth: 1,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
  },
  title: {
    flex: 1,
    paddingRight: 12,
    fontWeight: '600',
  },
})
