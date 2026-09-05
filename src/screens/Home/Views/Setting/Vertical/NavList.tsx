import { memo, useCallback, useState } from 'react'
import { View, ScrollView } from 'react-native'

import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { SETTING_SCREENS, type SettingScreenIds } from '../Main'
import { useI18n } from '@/lang'
import { BorderWidths } from '@/theme'
import { Q_UI } from '@/theme/ui'


const ListItem = memo(({ id, activeId, onPress }: {
  onPress: (item: SettingScreenIds) => void
  activeId: string
  id: SettingScreenIds
}) => {
  const theme = useTheme()
  const t = useI18n()

  const active = activeId == id

  const handlePress = () => {
    onPress(id)
  }

  return (
    <View style={{ ...styles.listItem, backgroundColor: active ? theme['q-surface-tint'] : 'transparent' }}>
      <Button
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={t(`setting_${id}`)}
        style={{ ...styles.listName, borderColor: active ? theme['q-outline'] : 'transparent' }}
        onPress={handlePress}
      >
        <Text numberOfLines={1} color={active ? theme['q-accent-text'] : theme['q-text-primary']}>{t(`setting_${id}`)}</Text>
      </Button>
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.id === nextProps.id &&
    prevProps.activeId != nextProps.id &&
    nextProps.activeId != nextProps.id
  )
})


export default ({ onChangeId }: {
  onChangeId: (id: SettingScreenIds) => void
}) => {
  const [activeId, setActiveId] = useState(global.lx.settingActiveId)
  const theme = useTheme()

  const handleChangeId = useCallback((id: SettingScreenIds) => {
    onChangeId(id)
    setActiveId(id)
    global.lx.settingActiveId = id
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ ...styles.container, borderBottomColor: theme['c-border-background'] }} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
      {
        SETTING_SCREENS.map(id => <ListItem key={id} id={id} activeId={activeId} onPress={handleChangeId} />)
      }
    </ScrollView>
  )
}


const styles = createStyle({
  container: {
    height: Q_UI.touchSize + 10,
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: BorderWidths.normal,
  },
  contentContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    padding: 5,
    // backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  // listContainer: {
  //   // borderBottomWidth: BorderWidths.normal2,
  // },

  listItem: {
    // width: '33.33%',
    height: Q_UI.touchSize,
    paddingLeft: 15,
    paddingRight: 15,
    // height: 'auto',
    // flexDirection: 'row',
    // alignItems: 'center',
    paddingHorizontal: 5,
    // paddingVertical: 10,
    borderRadius: Q_UI.radius.control,
    overflow: 'hidden',
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  listName: {
    minHeight: Q_UI.touchSize,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderRadius: Q_UI.radius.control,
    // paddingLeft: 5,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
})
