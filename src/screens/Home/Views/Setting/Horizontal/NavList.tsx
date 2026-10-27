import { memo, useEffect, useRef } from 'react'
import { View, FlatList, type FlatListProps } from 'react-native'

import { Icon } from '@/components/common/Icon'
import Button from '@/components/common/Button'

import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { SETTING_SCREENS, type SettingScreenIds } from '../Main'
import { useI18n } from '@/lang'
import { Q_UI } from '@/theme/ui'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import { selectSettingSection, useSettingSection } from '@/store/setting/navigation'

type FlatListType = FlatListProps<SettingScreenIds>

const ITEM_HEIGHT = Math.max(scaleSizeH(Q_UI.touchSize), Q_UI.touchSize)

const ListItem = memo(({ id, activeId, onPress, itemHeight }: {
  onPress: (item: SettingScreenIds) => void
  activeId: string
  id: SettingScreenIds
  itemHeight: number
}) => {
  const theme = useTheme()
  const t = useI18n()

  const active = activeId == id

  const handlePress = () => {
    onPress(id)
  }

  return (
    <Button
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={t(`setting_${id}`)}
      style={{
        ...styles.listItem,
        height: itemHeight - 6,
        backgroundColor: active ? theme['q-surface-tint'] : 'transparent',
        borderColor: active ? theme['q-outline'] : 'transparent',
      }}
      onPress={handlePress}
    >
      <View style={styles.listName}>
        <Text numberOfLines={1} size={15} style={{ fontWeight: active ? '600' : '400' }} color={active ? theme['q-accent-text'] : theme['q-text-primary']}>{t(`setting_${id}`)}</Text>
      </View>
      <Icon accessible={false} style={[styles.listActiveIcon, { opacity: active ? 1 : 0 }]} name="chevron-right" size={12} color={theme['q-accent-text']} />
    </Button>
  )
})


export default ({ onChangeId }: {
  onChangeId: (id: SettingScreenIds) => void
}) => {
  const flatListRef = useRef<FlatList>(null)
  const activeId = useSettingSection()
  const { isCar } = useAdaptiveLayout()
  const itemHeight = Math.max(ITEM_HEIGHT + 6, isCar ? 64 : 56)
  useEffect(() => {
    const index = SETTING_SCREENS.findIndex(id => id == activeId)
    if (index < 0) return
    const frame = requestAnimationFrame(() => { flatListRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false }) })
    return () => { cancelAnimationFrame(frame) }
  }, [activeId, itemHeight])

  const handleChangeId = (id: SettingScreenIds) => {
    onChangeId(id)
    selectSettingSection(id)
  }

  const renderItem: FlatListType['renderItem'] = ({ item, index }) => (
    <ListItem
      key={item}
      id={item}
      itemHeight={itemHeight}
      activeId={activeId}
      onPress={handleChangeId}
    />
  )
  const getkey: FlatListType['keyExtractor'] = item => item
  const getItemLayout: FlatListType['getItemLayout'] = (data, index) => {
    return { length: itemHeight, offset: 10 + itemHeight * index, index }
  }

  return (
    <FlatList
      key={itemHeight}
      ref={flatListRef}
      style={styles.container}
      contentContainerStyle={{ paddingVertical: 10 }}
      data={SETTING_SCREENS}
      maxToRenderPerBatch={9}
      // updateCellsBatchingPeriod={80}
      windowSize={9}
      removeClippedSubviews={true}
      initialNumToRender={18}
      renderItem={renderItem}
      keyExtractor={getkey}
      // extraData={activeIndex}
      getItemLayout={getItemLayout}
    />
  )
}


const styles = createStyle({
  container: {
    flexShrink: 1,
    flexGrow: 0,
  },
  // listContainer: {
  //   // borderBottomWidth: BorderWidths.normal2,
  // },

  listItem: {
    height: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    paddingLeft: 10,
    marginLeft: 6,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: Q_UI.radius.control,
    // borderBottomWidth: BorderWidths.normal,
  },
  listActiveIcon: {
    // width: 18,
    marginLeft: 3,
    // paddingRight: 5,
    textAlign: 'center',
  },
  listName: {
    height: '100%',
    // height: 46,
    // paddingTop: 12,
    // paddingBottom: 12,
    justifyContent: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 5,
    paddingRight: 8,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
})

