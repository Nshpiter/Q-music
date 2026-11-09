import { type ReactNode, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'

export default ({ children, enabled, index, count, onMove, height }: { children: ReactNode, enabled: boolean, index: number, count: number, height: number, onMove: (steps: number) => void }) => {
  const theme = useTheme()
  const translation = useRef(new Animated.Value(0)).current
  const [dragging, setDragging] = useState(false)
  const latest = useRef({ enabled, index, count, onMove })
  latest.current = { enabled, index, count, onMove }
  const responder = useMemo(() => {
    const finish = (dy: number, cancelled: boolean) => {
      const state = latest.current
      const steps = cancelled || !state.enabled ? 0 : Math.max(-state.index, Math.min(state.count - state.index - 1, Math.round(dy / height)))
      Animated.spring(translation, { toValue: steps * height, stiffness: 380, damping: 32, mass: 0.8, useNativeDriver: true }).start(({ finished }) => {
        if (finished && steps) latest.current.onMove(steps)
        translation.setValue(0)
        setDragging(false)
      })
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.enabled,
      onPanResponderGrant: () => { translation.stopAnimation(); setDragging(true) },
      onPanResponderMove: (_, gesture) => { translation.setValue(Math.max(-latest.current.index * height, Math.min((latest.current.count - latest.current.index - 1) * height, gesture.dy))) },
      onPanResponderRelease: (_, gesture) => { finish(gesture.dy, false) },
      onPanResponderTerminate: () => { finish(0, true) },
      onPanResponderTerminationRequest: () => false,
    })
  }, [translation, height])
  return <Animated.View style={{ height, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: dragging ? theme['q-surface-raised'] : 'transparent', transform: [{ translateY: translation }], zIndex: dragging ? 20 : 0, elevation: dragging ? 6 : 0 }}>
    {children}
    {enabled ? <View {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={global.i18n.t('playlist_order_title')} accessibilityActions={[{ name: 'increment', label: global.i18n.t('playlist_order_down') }, { name: 'decrement', label: global.i18n.t('playlist_order_up') }]} onAccessibilityAction={event => {
      const steps = event.nativeEvent.actionName == 'increment' ? 1 : -1
      if (index + steps >= 0 && index + steps < count) onMove(steps)
    }} style={{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}><Icon name="menu" size={20} color={theme['q-accent-text']} /></View> : null}
  </Animated.View>
}
