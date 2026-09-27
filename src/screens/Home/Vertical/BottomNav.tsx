import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Keyboard, Pressable, StyleSheet, View } from 'react-native'
import { setNavActiveId } from '@/core/common'
import { useI18n } from '@/lang'
import { useNavActiveId } from '@/store/common/hook'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import GlassSurface, { useGlassColors } from '@/components/common/GlassSurface'
import { useMotion } from '@/utils/useMotion'
import { Q_UI } from '@/theme/ui'

const MOBILE_NAV = [
  { id: 'nav_search', icon: 'search-2', label: 'mobile_discover' },
  { id: 'nav_songlist', icon: 'album', label: 'nav_songlist' },
  { id: 'nav_top', icon: 'leaderboard', label: 'nav_top' },
  { id: 'nav_love', icon: 'love', label: 'mobile_library' },
] as const

const NavItem = ({ id, icon, label }: typeof MOBILE_NAV[number]) => {
  const activeId = useNavActiveId()
  const colors = useGlassColors()
  const t = useI18n()
  const active = activeId == id || (id == 'nav_love' && (activeId == 'download' || activeId == 'nav_setting'))
  const motion = useMotion()
  const scale = useRef(new Animated.Value(1)).current
  const selectedScale = useRef(new Animated.Value(active ? 1.07 : 1)).current
  useEffect(() => {
    if (!motion) { scale.stopAnimation(); scale.setValue(1) }
    return () => { scale.stopAnimation() }
  }, [motion, scale])
  useEffect(() => {
    selectedScale.stopAnimation()
    if (motion) Animated.spring(selectedScale, { toValue: active ? 1.07 : 1, stiffness: 280, damping: 25, useNativeDriver: true }).start()
    else selectedScale.setValue(active ? 1.07 : 1)
    return () => { selectedScale.stopAnimation() }
  }, [active, motion, selectedScale])
  const press = (pressed: boolean) => {
    scale.stopAnimation()
    if (!motion) scale.setValue(1)
    else Animated.spring(scale, { toValue: pressed ? 0.91 : 1, ...Q_UI.motion.press, useNativeDriver: true }).start()
  }

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={t(label)}
      accessibilityState={{ selected: active }}
      style={styles.touchTarget}
      onPressIn={() => { press(true) }}
      onPressOut={() => { press(false) }}
      onPress={() => {
        Keyboard.dismiss()
        setNavActiveId(id)
      }}
    >
      <Animated.View style={[styles.item, { transform: [{ scale: Animated.multiply(scale, selectedScale) }] }]}>
        <View style={styles.iconFace}>
          <Icon
            accessible={false}
            name={icon}
            rawSize={20}
            color={active ? colors.active : colors.secondary}
          />
        </View>
        <Text
          style={styles.label}
          size={10}
          color={active ? colors.active : colors.secondary}
          numberOfLines={1}
        >
          {t(label)}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

export default memo(() => {
  const activeId = useNavActiveId()
  const motion = useMotion()
  const [width, setWidth] = useState(0)
  const lastLayout = useRef(0)
  const previousIndex = useRef(0)
  const leftEdge = useRef(new Animated.Value(0)).current
  const rightEdge = useRef(new Animated.Value(0)).current
  const cellWidth = Math.max(0, (width - 12) / MOBILE_NAV.length)
  const pillWidth = Math.max(0, cellWidth - 4)
  const index = Math.max(0, MOBILE_NAV.findIndex(item => item.id == activeId || (item.id == 'nav_love' && (activeId == 'download' || activeId == 'nav_setting'))))
  const span = Animated.subtract(rightEdge, leftEdge)
  useEffect(() => {
    const target = 8 + cellWidth * index
    const movingRight = index >= previousIndex.current
    leftEdge.stopAnimation()
    rightEdge.stopAnimation()
    if (!motion || lastLayout.current != width) {
      leftEdge.setValue(target)
      rightEdge.setValue(target + pillWidth)
    } else {
      // 两端以不同速度追随目标，跨越时拉伸，抵达后自然收拢。
      const leading = { stiffness: 390, damping: 27, mass: 0.72, useNativeDriver: true }
      const trailing = { stiffness: 205, damping: 23, mass: 0.82, useNativeDriver: true }
      Animated.parallel([
        Animated.spring(leftEdge, { toValue: target, ...(movingRight ? trailing : leading) }),
        Animated.spring(rightEdge, { toValue: target + pillWidth, ...(movingRight ? leading : trailing) }),
      ]).start()
    }
    lastLayout.current = width
    previousIndex.current = index
    return () => { leftEdge.stopAnimation(); rightEdge.stopAnimation() }
  }, [cellWidth, index, leftEdge, motion, pillWidth, rightEdge, width])

  return (
    <GlassSurface
      selection
      radius={Q_UI.radius.dock}
      onLayout={event => { setWidth(event.nativeEvent.layout.width) }}
      style={styles.container}
    >
      {pillWidth > 0 ? <Animated.View nativeID="qmusic-glass-selection" collapsable={false} pointerEvents="none" style={[styles.activePill, {
        width: pillWidth,
        transform: [
          { translateX: Animated.divide(Animated.subtract(Animated.add(leftEdge, rightEdge), pillWidth), 2) },
          { scaleX: span.interpolate({ inputRange: [0, pillWidth, pillWidth * 1.6], outputRange: [0.9, 1, 1.24], extrapolate: 'clamp' }) },
          { scaleY: span.interpolate({ inputRange: [0, pillWidth, pillWidth * 1.6], outputRange: [1, 1, 0.98], extrapolate: 'clamp' }) },
        ],
      }]} /> : null}
      {MOBILE_NAV.map(item => <NavItem key={item.id} {...item} />)}
    </GlassSurface>
  )
})

const styles = StyleSheet.create({
  activePill: { position: 'absolute', left: 0, top: 4, bottom: 4, borderRadius: 26 },
  container: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginHorizontal: 14,
    marginBottom: 8,
  },
  touchTarget: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
  },
  item: {
    width: '100%',
    maxWidth: 96,
    minHeight: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFace: {
    width: 42,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    width: '100%',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
})
