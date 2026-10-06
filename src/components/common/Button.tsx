import { useTheme } from '@/store/theme/hook'
import { useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { Animated, Pressable, type GestureResponderEvent, type PressableProps, type PressableStateCallbackType, type View } from 'react-native'
import { Q_UI } from '@/theme/ui'
import { useMotion } from '@/utils/useMotion'
// import { AppColors } from '@/theme'


export interface BtnProps extends PressableProps {
  ripple?: PressableProps['android_ripple']
  onChangeText?: (value: string) => void
  onClearText?: () => void
  /** 独立控件按下时的缩放比例；列表行等大面积按钮不要开启。 */
  pressScale?: number
  children: React.ReactNode
}


export interface BtnType {
  measure: (callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void
}

const pressedStyle = { opacity: Q_UI.button.pressedOpacity }
const disabledStyle = { opacity: Q_UI.button.disabledOpacity }

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const ScalePressable = forwardRef<View, PressableProps & { pressScale: number }>(({ pressScale, style, disabled, onPressIn, onPressOut, ...props }, ref) => {
  const motion = useMotion()
  const scale = useRef(new Animated.Value(1)).current
  const [pressed, setPressed] = useState(false)
  const animateTo = (value: number) => {
    if (!motion) {
      scale.setValue(1)
      return
    }
    Animated.spring(scale, { toValue: value, ...Q_UI.motion.press, useNativeDriver: true }).start()
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
        pressed && !disabled ? pressedStyle : null,
        disabled ? disabledStyle : null,
        { transform: [{ scale }] },
      ]}
    />
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
  const btnRef = useRef<View>(null)
  const ripple = useMemo(() => {
    const configuredRipple = propsRipple !== undefined ? propsRipple : propsAndroidRipple
    if (configuredRipple === null) return null
    return {
      color: theme['c-primary-light-200-alpha-700'],
      ...(configuredRipple ?? {}),
    }
  }, [propsAndroidRipple, propsRipple, theme])

  const buttonStyle = (state: PressableStateCallbackType) => [
    typeof style === 'function' ? style(state) : style,
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

  if (pressScale != null && pressScale != 1) {
    return (
      <ScalePressable
        android_ripple={ripple}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityState={resolvedAccessibilityState}
        style={style}
        pressScale={pressScale}
        {...props}
        ref={btnRef}
      >
        {children}
      </ScalePressable>
    )
  }

  return (
    <Pressable
      android_ripple={ripple}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={resolvedAccessibilityState}
      style={buttonStyle}
      {...props}
      ref={btnRef}
    >
      {children}
    </Pressable>
  )
})
