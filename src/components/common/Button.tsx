import { useTheme } from '@/store/theme/hook'
import { useMemo, useRef, useImperativeHandle, forwardRef } from 'react'
import { Pressable, type PressableProps, type PressableStateCallbackType, type View } from 'react-native'
import { Q_UI } from '@/theme/ui'
// import { AppColors } from '@/theme'


export interface BtnProps extends PressableProps {
  ripple?: PressableProps['android_ripple']
  onChangeText?: (value: string) => void
  onClearText?: () => void
  children: React.ReactNode
}


export interface BtnType {
  measure: (callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void
}

const pressedStyle = { opacity: Q_UI.button.pressedOpacity }
const disabledStyle = { opacity: Q_UI.button.disabledOpacity }

export default forwardRef<BtnType, BtnProps>(({
  ripple: propsRipple,
  android_ripple: propsAndroidRipple,
  disabled,
  children,
  style,
  hitSlop,
  accessibilityRole,
  accessibilityState,
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

