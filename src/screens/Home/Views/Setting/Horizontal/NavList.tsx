import { memo, useEffect, useRef, useState } from 'react'
import { Animated, ScrollView, StyleSheet, View } from 'react-native'

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
import { useInteractionMotion } from '@/utils/useMotion'

const ITEM_HEIGHT = Math.max(scaleSizeH(Q_UI.touchSize), Q_UI.touchSize)

const NAV_ICONS: Record<typeof SETTING_SCREENS[number], string> = {
  overview: 'setting',
  appearance: 'palette',
  sources: 'slider',
  basic: 'setting',
  player: 'play-outline',
  lyrics: 'lyric-on',
  background: 'shield',
  search: 'search-2',
  list: 'album',
  download: 'download-2',
  cloud: 'cloud-library',
  sync: 'available_updates',
  backup: 'save',
  other: 'tool',
  version: 'version-info',
  about: 'help',
}

const ListItem = memo(({ id, activeId, onPress, itemHeight }: {
  onPress: (item: SettingScreenIds) => void
  activeId: string
  id: typeof SETTING_SCREENS[number]
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
        backgroundColor: 'transparent',
        borderColor: 'transparent',
      }}
      onPress={handlePress}
    >
      <Icon accessible={false} style={styles.listIcon} name={NAV_ICONS[id]} size={15} color={active ? theme['q-accent-text'] : theme['q-text-secondary']} />
      <View style={styles.listName}>
        <Text numberOfLines={1} size={14} style={{ fontWeight: active ? '600' : '400' }} color={active ? theme['q-accent-text'] : theme['q-text-primary']}>{t(`setting_${id}`)}</Text>
      </View>
      <Icon accessible={false} style={[styles.listActiveIcon, { opacity: active ? 1 : 0 }]} name="chevron-right" size={12} color={theme['q-accent-text']} />
    </Button>
  )
})


export default ({ onChangeId }: {
  onChangeId: (id: SettingScreenIds) => void
}) => {
  const scrollRef = useRef<ScrollView>(null)
  const activeId = useSettingSection()
  const theme = useTheme()
  const motion = useInteractionMotion()
  const { isCar } = useAdaptiveLayout()
  const itemHeight = Math.max(ITEM_HEIGHT + 6, isCar ? 64 : 56)
  const [viewportHeight, setViewportHeight] = useState(0)
  const activeIndex = Math.max(0, SETTING_SCREENS.findIndex(id => id == activeId || (activeId == 'lyric_desktop' && id == 'lyrics')))
  const pillY = useRef(new Animated.Value(activeIndex * itemHeight)).current
  const lastItemHeight = useRef(itemHeight)

  useEffect(() => {
    pillY.stopAnimation()
    const target = activeIndex * itemHeight
    if (!motion || lastItemHeight.current != itemHeight) {
      pillY.setValue(target)
    } else {
      Animated.spring(pillY, { toValue: target, ...Q_UI.motion.settle, overshootClamping: true, useNativeDriver: true }).start()
    }
    lastItemHeight.current = itemHeight
    return () => { pillY.stopAnimation() }
  }, [activeIndex, itemHeight, motion, pillY])

  useEffect(() => {
    if (!viewportHeight) return
    const targetY = Math.max(0, 10 + activeIndex * itemHeight - (viewportHeight - itemHeight) / 2)
    const frame = requestAnimationFrame(() => { scrollRef.current?.scrollTo({ y: targetY, animated: motion }) })
    return () => { cancelAnimationFrame(frame) }
  }, [activeIndex, itemHeight, motion, viewportHeight])

  const handleChangeId = (id: SettingScreenIds) => {
    onChangeId(id)
    selectSettingSection(id)
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      onLayout={event => { setViewportHeight(event.nativeEvent.layout.height) }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          {
            height: itemHeight - 6,
            backgroundColor: theme['q-surface-tint'],
            borderColor: theme['q-outline'],
            transform: [{ translateY: pillY }],
          },
        ]}
      />
      {SETTING_SCREENS.map(id => (
        <ListItem
          key={id}
          id={id}
          itemHeight={itemHeight}
          activeId={activeId}
          onPress={handleChangeId}
        />
      ))}
    </ScrollView>
  )
}


const styles = createStyle({
  container: {
    flexShrink: 1,
    flexGrow: 0,
  },
  contentContainer: {
    paddingVertical: 10,
  },
  indicator: {
    position: 'absolute',
    top: 10,
    left: 6,
    right: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Q_UI.radius.control,
  },
  listItem: {
    height: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    paddingLeft: 12,
    marginLeft: 6,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: Q_UI.radius.control,
  },
  listIcon: {
    marginRight: 8,
  },
  listActiveIcon: {
    marginLeft: 3,
    textAlign: 'center',
  },
  listName: {
    height: '100%',
    justifyContent: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 6,
  },
})

