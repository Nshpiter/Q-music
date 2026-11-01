import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, BackHandler, PanResponder, ScrollView, StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'
import GlassSurface from '@/components/common/GlassSurface'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { setNavActiveId, updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { useKeyboard } from '@/utils/hooks'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import { useInteractionMotion } from '@/utils/useMotion'
import { clamp, floatingBounds, floatingPosition, snapFloatingPosition } from '@/utils/floatingNavigation'
import { MOBILE_NAV } from './BottomNav'

export default ({ bottomInset }: { bottomInset: number }) => {
  const t = useI18n()
  const theme = useTheme()
  const activeId = useNavActiveId()
  const statusBarHeight = useStatusbarHeight()
  const { isCar } = useAdaptiveLayout()
  const { keyboardShown } = useKeyboard()
  const motion = useInteractionMotion()
  const side = useSettingValue('common.floatingNavigationSide')
  const offset = useSettingValue('common.floatingNavigationOffset')
  const autoCollapse = useSettingValue('common.floatingNavigationAutoCollapse')
  const [expanded, setExpanded] = useState(false)
  const reveal = useRef(new Animated.Value(0)).current
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>()
  const touching = useRef(false)
  const clearCollapseTimer = useCallback(() => {
    if (collapseTimer.current != null) clearTimeout(collapseTimer.current)
    collapseTimer.current = undefined
  }, [])
  const restartCollapseTimer = useCallback(() => {
    clearCollapseTimer()
    if (expanded && autoCollapse && !keyboardShown && !touching.current) {
      collapseTimer.current = setTimeout(() => { setExpanded(false) }, 8000)
    }
  }, [autoCollapse, expanded, keyboardShown, clearCollapseTimer])
  useEffect(() => {
    restartCollapseTimer()
    return clearCollapseTimer
  }, [activeId, restartCollapseTimer, clearCollapseTimer])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const position = useRef(new Animated.ValueXY()).current
  const current = useRef({ x: 0, y: 0 })
  const origin = useRef({ x: 0, y: 0 })
  const previousLayout = useRef('')
  const panelWidth = isCar ? 80 : 64
  const handleHeight = isCar ? 56 : 44
  const expandedHeight = Math.max(handleHeight, Math.min(size.height, handleHeight + (isCar ? 72 : 56) * MOBILE_NAV.length + 8))
  const panelHeight = expanded ? expandedHeight : handleHeight
  useEffect(() => {
    // 保留菜单节点，以同一进度驱动尺寸和内容；连续点击可从当前位置反向过渡。
    reveal.stopAnimation()
    if (motion) Animated.spring(reveal, { toValue: expanded ? 1 : 0, stiffness: 320, damping: 28, mass: 0.8, overshootClamping: true, useNativeDriver: false }).start()
    else reveal.setValue(expanded ? 1 : 0)
    return () => { reveal.stopAnimation() }
  }, [expanded, motion, reveal])
  const bounds = floatingBounds(size.width, size.height, panelWidth, panelHeight)
  const animateTo = (target: { x: number, y: number }) => {
    current.current = target
    position.stopAnimation()
    if (motion) Animated.spring(position, { toValue: target, stiffness: 320, damping: 28, mass: 0.8, useNativeDriver: true }).start()
    else position.setValue(target)
  }
  useEffect(() => {
    // 尺寸变化直接归位，不让横竖屏切换期间的侧栏越界。
    const target = floatingPosition(size.width, size.height, panelWidth, panelHeight, side, offset, handleHeight)
    const layout = `${size.width}:${size.height}:${panelWidth}`
    position.stopAnimation()
    if (motion && previousLayout.current == layout) Animated.spring(position, { toValue: target, stiffness: 320, damping: 28, mass: 0.8, useNativeDriver: true }).start()
    else position.setValue(target)
    previousLayout.current = layout
    current.current = target
    return () => { position.stopAnimation() }
  }, [offset, panelHeight, panelWidth, position, side, size, motion, handleHeight])
  useEffect(() => { if (keyboardShown) setExpanded(false) }, [keyboardShown])
  useEffect(() => {
    if (!expanded) return
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setExpanded(false); return true })
    return () => { listener.remove() }
  }, [expanded])
  const save = (point: { x: number, y: number }) => {
    const snapped = snapFloatingPosition(point.x, point.y, size.width, size.height, panelWidth, panelHeight, handleHeight)
    animateTo({ x: snapped.x, y: snapped.y })
    updateSetting({ 'common.floatingNavigationSide': snapped.side, 'common.floatingNavigationOffset': snapped.offset })
  }
  // 只在顶部手柄识别拖动；导航按钮和页面滚动不抢 responder。
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 7,
    onPanResponderGrant: () => {
      origin.current = current.current
      position.stopAnimation(value => { origin.current = value; current.current = value })
    },
    onPanResponderMove: (_event, gesture) => {
      const target = { x: clamp(origin.current.x + gesture.dx, bounds.minX, bounds.maxX), y: clamp(origin.current.y + gesture.dy, 0, bounds.maxY) }
      current.current = target
      position.setValue(target)
    },
    onPanResponderRelease: () => { save(current.current) },
    onPanResponderTerminate: () => { animateTo(origin.current) },
    onPanResponderTerminationRequest: () => false,
  // 事件仅在布局或动效偏好变化时重建，拖动期间不触发 React 更新。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [size, panelHeight, panelWidth, motion, side, offset])
  const active = MOBILE_NAV.find(item => item.id == activeId || (item.id == 'nav_love' && (activeId == 'download' || activeId == 'nav_setting'))) ?? MOBILE_NAV[0]
  return <View pointerEvents="box-none" style={[styles.area, { top: statusBarHeight + 60, bottom: bottomInset + 12 }]} onLayout={event => {
    const { width, height } = event.nativeEvent.layout
    setSize(previous => previous.width == width && previous.height == height ? previous : { width, height })
  }}>
    {size.width > 0 && size.height >= handleHeight && !keyboardShown ? <Animated.View
      onTouchStart={() => { touching.current = true; clearCollapseTimer() }}
      onTouchEnd={() => { touching.current = false; restartCollapseTimer() }}
      onTouchCancel={() => { touching.current = false; restartCollapseTimer() }}
      style={[styles.panel, { width: panelWidth, transform: position.getTranslateTransform() }]}>
      {/* 原生位移动画与布局动画分层，避免 RN 将 height 误送进原生动画驱动。 */}
      <Animated.View style={{ height: reveal.interpolate({ inputRange: [0, 1], outputRange: [handleHeight, expandedHeight], extrapolate: 'clamp' }) }}>
      {/* 只改变外层裁切高度，玻璃采样层保持固定尺寸，避免动效每帧重建模糊底图。 */}
      <View style={{ flex: 1, borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: theme['q-outline'] }}>
      <GlassSurface radius={24} style={{ height: expandedHeight }}>
        <View {...responder.panHandlers}>
          <Button accessibilityLabel={t('floating_navigation_toggle')} accessibilityHint={t('floating_navigation_hint')} accessibilityState={{ expanded }}
            accessibilityActions={[{ name: 'increment', label: t('setting_navigation_right') }, { name: 'decrement', label: t('setting_navigation_left') }]}
            onAccessibilityAction={event => { if (event.nativeEvent.actionName == 'increment' || event.nativeEvent.actionName == 'decrement') updateSetting({ 'common.floatingNavigationSide': event.nativeEvent.actionName == 'increment' ? 'right' : 'left' }) }}
            onPress={() => { setExpanded(value => !value) }} style={{ height: handleHeight, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: theme['q-text-secondary'], opacity: 0.5 }} />
            <View pointerEvents="none" style={styles.handleIcon}>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }) }] }]}>
                <Icon name={active.icon} rawSize={20} color={theme['q-accent-text']} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: reveal, transform: [{ rotate: reveal.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) }] }]}>
                <Icon name="chevron-up" rawSize={20} color={theme['q-accent-text']} />
              </Animated.View>
            </View>
          </Button>
        </View>
        <Animated.View pointerEvents={expanded ? 'auto' : 'none'} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
          style={{ height: expandedHeight - handleHeight, opacity: reveal.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }), transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [-8, 0], extrapolate: 'clamp' }) }] }}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 8 }}>
          {MOBILE_NAV.map(item => <Button key={item.id} accessibilityRole="tab" accessibilityLabel={t(item.label)} accessibilityState={{ selected: active.id == item.id }} onPress={() => { setNavActiveId(item.id); restartCollapseTimer() }}
            style={{ height: isCar ? 72 : 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: active.id == item.id ? theme['q-surface-tint'] : 'transparent' }}>
            <Icon name={item.icon} rawSize={isCar ? 25 : 20} color={active.id == item.id ? theme['q-accent-text'] : theme['q-text-secondary']} />
            <Text size={isCar ? 13 : 10} numberOfLines={1} color={active.id == item.id ? theme['q-accent-text'] : theme['q-text-secondary']}>{t(item.label)}</Text>
          </Button>)}
          </ScrollView>
        </Animated.View>
      </GlassSurface>
      </View>
      </Animated.View>
    </Animated.View> : null}
  </View>
}

const styles = StyleSheet.create({
  handleIcon: { width: 20, height: 20 },
  area: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
  panel: { position: 'absolute', top: 0, left: 0, elevation: 8, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 12 },
})
