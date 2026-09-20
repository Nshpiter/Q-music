import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, type ColorValue } from 'react-native'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useMotion } from '@/utils/useMotion'
import { Q_UI } from '@/theme/ui'

// 迷你栏与详情共用控制规范：固定触控区域、光学校正、按压反馈。
export default ({ icon, label, onPress, size = 48, faceSize = size, iconSize = 24, primary = false, outlined = false, color }: {
  icon: string
  label: string
  onPress: () => void
  size?: number
  faceSize?: number
  iconSize?: number
  primary?: boolean
  outlined?: boolean
  color?: ColorValue
}) => {
  const theme = useTheme()
  const foreground = color ?? theme['q-text-primary']
  const motion = useMotion()
  const scale = useRef(new Animated.Value(1)).current
  const press = (pressed: boolean) => {
    scale.stopAnimation()
    if (!motion) { scale.setValue(1); return }
    Animated.spring(scale, { toValue: pressed ? 0.9 : 1, ...Q_UI.motion.press, useNativeDriver: true }).start()
  }
  useEffect(() => {
    if (!motion) { scale.stopAnimation(); scale.setValue(1) }
    return () => { scale.stopAnimation() }
  }, [motion, scale])
  return <Button
    accessibilityLabel={label}
    ripple={null}
    onPress={onPress}
    onPressIn={() => { press(true) }}
    onPressOut={() => { press(false) }}
    hitSlop={size < 44 ? (44 - size) / 2 : 0}
    style={[styles.button, { width: size, height: size }]}
  >
    <Animated.View pointerEvents="none" style={[styles.button, {
      width: faceSize,
      height: faceSize,
      borderRadius: faceSize / 2,
      backgroundColor: primary && !outlined ? foreground : 'transparent',
      borderWidth: outlined ? 1 : 0,
      borderColor: foreground,
      transform: [{ scale }],
    }]}>
    <Icon accessible={false} name={icon} rawSize={iconSize}
      color={primary && !outlined ? theme['c-content-background'] : foreground}
      style={icon == 'play' ? { marginLeft: 2 } : undefined} />
    </Animated.View>
  </Button>
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
})
