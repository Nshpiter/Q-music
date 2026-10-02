import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, ScrollView, type LayoutChangeEvent } from 'react-native'

import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { SETTING_SCREENS, type SettingScreenIds } from '../Main'
import { useI18n } from '@/lang'
import { BorderWidths } from '@/theme'
import { Q_UI } from '@/theme/ui'


const ListItem = memo(({ id, activeId, onPress, onLayout }: {
  onPress: (item: SettingScreenIds) => void
  onLayout: (id: SettingScreenIds, event: LayoutChangeEvent) => void
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
    <View onLayout={event => { onLayout(id, event) }} style={{ ...styles.listItem, backgroundColor: active ? theme['q-surface-tint'] : 'transparent' }}>
      <Button
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={t(`setting_${id}`)}
        style={{ ...styles.listName, borderColor: active ? theme['q-outline'] : 'transparent' }}
        onPress={handlePress}
      >
        <Text size={13} numberOfLines={1} color={active ? theme['q-accent-text'] : theme['q-text-primary']}>{t(`setting_${id}`)}</Text>
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
  const activeIdRef = useRef(activeId)
  const scrollRef = useRef<ScrollView>(null)
  const viewportWidthRef = useRef(0)
  const layoutsRef = useRef<Partial<Record<SettingScreenIds, { x: number, width: number }>>>({})
  const theme = useTheme()
  activeIdRef.current = activeId

  const scrollToActive = useCallback((animated: boolean) => {
    const layout = layoutsRef.current[activeIdRef.current]
    const viewportWidth = viewportWidthRef.current
    if (!layout || !viewportWidth) return
    scrollRef.current?.scrollTo({ x: Math.max(0, layout.x - (viewportWidth - layout.width) / 2), animated })
  }, [])

  const handleItemLayout = useCallback((id: SettingScreenIds, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    layoutsRef.current[id] = { x, width }
    if (id == activeIdRef.current) scrollToActive(false)
  }, [scrollToActive])

  useEffect(() => {
    const frame = requestAnimationFrame(() => { scrollToActive(true) })
    return () => { cancelAnimationFrame(frame) }
  }, [activeId, scrollToActive])

  const handleChangeId = useCallback((id: SettingScreenIds) => {
    onChangeId(id)
    setActiveId(id)
    global.lx.settingActiveId = id
  }, [onChangeId])

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ ...styles.container, borderBottomColor: theme['c-border-background'] }}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      onLayout={event => {
        viewportWidthRef.current = event.nativeEvent.layout.width
        scrollToActive(false)
      }}
      onContentSizeChange={() => { scrollToActive(false) }}
    >
      {
        SETTING_SCREENS.map(id => <ListItem key={id} id={id} activeId={activeId} onPress={handleChangeId} onLayout={handleItemLayout} />)
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
    // height: 'auto',
    // flexDirection: 'row',
    // alignItems: 'center',
    paddingHorizontal: 5,
    // paddingVertical: 10,
    borderRadius: 24,
    overflow: 'hidden',
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  listName: {
    minHeight: Q_UI.touchSize,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 12,
    borderWidth: 0,
    borderRadius: 24,
    // paddingLeft: 5,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
})
