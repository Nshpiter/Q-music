import { useTheme } from '@/store/theme/hook'
import { createContext, useContext, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { Animated, Pressable, StyleSheet, View, type ColorValue, type GestureResponderEvent, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native'
import { Q_UI } from '@/theme/ui'
import { useInteractionMotion } from '@/utils/useMotion'
// import { AppColors } from '@/theme'


export interface BtnProps extends PressableProps {
  ripple?: PressableProps['android_ripple']
  onChangeText?: (value: string) => void
  onClearText?: () => void
  /** 按下时的缩放比例；设置行仅用接近 1 的轻微反馈，避免大面积跳动。 */
  pressScale?: number
  children: React.ReactNode
}


export interface BtnType {
  measure: (callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void
}

const pressedStyle = { opacity: Q_UI.button.pressedOpacity }
const disabledStyle = { opacity: Q_UI.button.disabledOpacity }

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
// 设置页沿用轻微缩放；控件自带的圆角、胶囊和圆形轮廓始终优先。
export const SettingsPressContext = createContext(false)
const defaultShape = { borderRadius: Q_UI.radius.control }
const clipShape = { overflow: 'hidden' as const }

// RN 0.73 的原生背景水波纹在圆角裁切之前绘制，只有 overflow:hidden 仍可能出现矩形。
// 将按下反馈放到控件内部，与内容和选中背景共用同一条圆角边界。
const Feedback = ({ color }: { color: ColorValue }) => <View testID="button-press-feedback" pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />

const ScalePressable = forwardRef<View, PressableProps & { pressScale: number, feedbackColor?: ColorValue }>(({ pressScale, style, disabled, onPressIn, onPressOut, children, feedbackColor, ...props }, ref) => {
  const motion = useInteractionMotion()
  const settingsPress = useContext(SettingsPressContext)
  const scale = useRef(new Animated.Value(1)).current
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    if (disabled) setPressed(false)
    if (disabled === true || !motion) { scale.stopAnimation(); scale.setValue(1) }
    return () => { scale.stopAnimation() }
  }, [disabled, motion, scale])
  const animateTo = (value: number) => {
    if (!motion) {
      scale.setValue(1)
      return
    }
    Animated.spring(scale, { toValue: value, ...Q_UI.motion.press, ...(settingsPress && value == 1 ? { stiffness: 380, damping: 23, mass: 0.7 } : {}), useNativeDriver: true }).start()
  }
  const handlePressIn = (event: GestureResponderEvent) => {
    setPressed(true)
    animateTo(pressScale)
    onPressIn?.(event)
  }
  const handlePressOut = (event: GestureResponderEvent) => {
    setPressed(false)
    animateTo(1)
    onPressOut?.(event)
  }
  const state: PressableStateCallbackType = { pressed }
  return (
    <AnimatedPressable
      {...props}
      ref={ref}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        typeof style === 'function' ? style(state) : style,
        pressed && !disabled ? (settingsPress ? { opacity: 0.9 } : pressedStyle) : null,
        disabled ? disabledStyle : null,
        { transform: [{ scale }] },
      ]}
    >
      {typeof children === 'function' ? children(state) : children}
      {pressed && !disabled && feedbackColor != null ? <Feedback color={feedbackColor} /> : null}
    </AnimatedPressable>
  )
})

export default forwardRef<BtnType, BtnProps>(({
  ripple: propsRipple,
  android_ripple: propsAndroidRipple,
  disabled,
  children,
  style,
  hitSlop,
  accessibilityRole,
  accessibilityState,
  pressScale,
  ...props
}, ref) => {
  const theme = useTheme()
  const settingsPress = useContext(SettingsPressContext)
  const resolvedStyle = useMemo<PressableProps['style']>(() => {
    const resolve = (value: StyleProp<ViewStyle>) => {
      const flat = StyleSheet.flatten(value)
      const hasRadius = flat && Object.keys(flat).some(key => /^border.*Radius$/.test(key))
      return [hasRadius ? null : defaultShape, value, clipShape]
    }
    return typeof style === 'function' ? state => resolve(style(state)) : resolve(style)
  }, [style])
  const resolvedScale = pressScale ?? (settingsPress ? 0.985 : undefined)
  const btnRef = useRef<View>(null)
  const feedbackColor = useMemo(() => {
    const configuredRipple = propsRipple !== undefined ? propsRipple : propsAndroidRipple
    if (configuredRipple === null) return undefined
    return configuredRipple?.color ?? theme['q-surface-tint']
  }, [propsAndroidRipple, propsRipple, theme])

  const buttonStyle = (state: PressableStateCallbackType) => [
    typeof resolvedStyle === 'function' ? resolvedStyle(state) : resolvedStyle,
    state.pressed && !disabled ? pressedStyle : null,
    disabled ? disabledStyle : null,
  ]

  const resolvedAccessibilityState = disabled == null
    ? accessibilityState
    : { ...accessibilityState, disabled: !!disabled }

  useImperativeHandle(ref, () => ({
    measure(callback) {
      btnRef.current?.measure(callback)
    },
  }))

  if (resolvedScale != null && resolvedScale != 1) {
    return (
      <ScalePressable
        feedbackColor={feedbackColor}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityState={resolvedAccessibilityState}
        style={resolvedStyle}
        pressScale={resolvedScale}
        {...props}
        ref={btnRef}
      >
        {children}
      </ScalePressable>
    )
  }

  return (
    <Pressable
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={resolvedAccessibilityState}
      style={buttonStyle}
      {...props}
      ref={btnRef}
    >
      {({ pressed }) => <>
        {children}
        {pressed && !disabled && feedbackColor != null ? <Feedback color={feedbackColor} /> : null}
      </>}
    </Pressable>
  )
})
