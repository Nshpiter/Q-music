import * as React from 'react'
import {
  Animated,
  type GestureResponderEvent,
  View,
  Pressable,
} from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'

export interface Props {
  /**
   * Status of checkbox.
   */
  status: 'checked' | 'unchecked' | 'indeterminate'
  /**
   * Whether checkbox is disabled.
   */
  disabled?: boolean
  /**
   * Function to execute on press.
   */
  onPress?: (e: GestureResponderEvent) => void

  size?: number

  /**
   * Custom color for checkbox.
   */
  tintColors: {
    true: string
    false: string
  }
  variant?: 'checkbox' | 'radio'
}

const ANIMATION_DURATION = 200

/**
 * Q-music 的玻璃勾选控件。视觉尺寸保持紧凑，外层保留足够触控区域。
 */
const Checkbox = ({
  status,
  disabled,
  size = 1,
  onPress,
  tintColors,
  variant = 'checkbox',
  ...rest
}: Props) => {
  const theme = useTheme()
  const checked = status === 'checked'
  const indeterminate = status === 'indeterminate'
  const selected = checked || indeterminate

  const { current: scaleAnim } = React.useRef<Animated.Value>(
    new Animated.Value(selected ? 1 : 0),
  )

  const isFirstRendering = React.useRef<boolean>(true)


  React.useEffect(() => {
    // Do not run animation on very first rendering
    if (isFirstRendering.current) {
      isFirstRendering.current = false
      return
    }

    Animated.timing(scaleAnim, {
      toValue: selected ? 1 : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start()
  }, [selected, scaleAnim])

  const controlSize = 20 * size
  const touchSize = Math.max(32, 32 * size)
  const controlRadius = variant === 'radio' ? controlSize / 2 : 7 * size
  const borderColor = selected ? tintColors.true : tintColors.false


  return (
    <Pressable
      {...rest}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={variant === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ disabled, checked }}
      accessibilityLiveRegion="polite"
      style={{
        ...styles.container,
        width: touchSize,
        height: touchSize,
        marginLeft: -(touchSize - controlSize) / 2,
      }}
    >
      <View
        style={{
          ...styles.control,
          width: controlSize,
          height: controlSize,
          borderRadius: controlRadius,
          borderColor,
          backgroundColor: theme['q-surface-base'],
        }}
      >
        <Animated.View
          style={{
            ...styles.markContainer,
            opacity: scaleAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          {
            variant === 'radio'
              ? (
                  <View
                    style={{
                      width: 8 * size,
                      height: 8 * size,
                      borderRadius: 4 * size,
                      backgroundColor: tintColors.true,
                    }}
                  />
                )
              : indeterminate
                ? (
                    <View
                      style={{
                        width: 10 * size,
                        height: 2 * size,
                        borderRadius: size,
                        backgroundColor: tintColors.true,
                      }}
                    />
                  )
                : (
                    <View
                      style={{
                        ...styles.checkMark,
                        width: 6 * size,
                        height: 10 * size,
                        borderRightWidth: 2 * size,
                        borderBottomWidth: 2 * size,
                        borderColor: tintColors.true,
                      }}
                    />
                  )
          }
        </Animated.View>
      </View>
    </Pressable>
  )
}

Checkbox.displayName = 'Checkbox'

const styles = createStyle({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  control: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    transform: [
      { rotate: '45deg' },
      { translateX: -1 },
      { translateY: -1 },
    ],
  },
})

export default Checkbox

