import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, Keyboard, Pressable, StyleSheet, View } from 'react-native'
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
  useEffect(() => {
    if (!motion) { scale.stopAnimation(); scale.setValue(1) }
    return () => { scale.stopAnimation() }
  }, [motion, scale])
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
      <Animated.View style={[styles.item, { transform: [{ scale }] }]}>
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
  const position = useRef(new Animated.Value(0)).current
  const stretch = useRef(new Animated.Value(0)).current
  const cellWidth = Math.max(0, (width - 12) / MOBILE_NAV.length)
  const index = Math.max(0, MOBILE_NAV.findIndex(item => item.id == activeId || (item.id == 'nav_love' && (activeId == 'download' || activeId == 'nav_setting'))))
  useEffect(() => {
    const target = 8 + cellWidth * index
    position.stopAnimation()
    stretch.stopAnimation()
    if (!motion || lastLayout.current != width) {
      position.setValue(target)
      stretch.setValue(0)
    } else {
      // 位移与形变分离，原生线程插值；连续点击从当前帧接续，不跳回旧位置。
      Animated.parallel([
        Animated.spring(position, { toValue: target, ...Q_UI.motion.settle, useNativeDriver: true, overshootClamping: true }),
        Animated.sequence([
          Animated.timing(stretch, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(stretch, { toValue: 0, stiffness: 240, damping: 22, mass: 0.7, useNativeDriver: true }),
        ]),
      ]).start()
    }
    lastLayout.current = width
    return () => { position.stopAnimation(); stretch.stopAnimation() }
  }, [cellWidth, index, motion, position, stretch, width])

  return (
    <GlassSurface
      selection
      radius={Q_UI.radius.dock}
      onLayout={event => { setWidth(event.nativeEvent.layout.width) }}
      style={styles.container}
    >
      {cellWidth > 4 ? <Animated.View nativeID="qmusic-glass-selection" collapsable={false} pointerEvents="none" style={[styles.activePill, {
        width: cellWidth - 4,
        transform: [
          { translateX: position },
          { scaleX: stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.075] }) },
          { scaleY: stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 0.955] }) },
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
