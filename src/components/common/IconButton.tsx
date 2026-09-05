import { memo, type ComponentProps } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

import Button, { type BtnProps } from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { Q_UI } from '@/theme/ui'
import { useTheme } from '@/store/theme/hook'

type IconName = ComponentProps<typeof Icon>['name']

export interface IconButtonProps extends Omit<BtnProps, 'children' | 'style'> {
  name: IconName
  accessibilityLabel: string
  /** Visual face size. The default keeps icon-only controls at a 48dp target. */
  size?: number
  iconSize?: number
  iconColor?: string
  /** `tonal` is selected-state friendly; `outlined` is useful on surfaces. */
  variant?: 'plain' | 'tonal' | 'outlined'
  selected?: boolean
  radius?: number
  /** Disable the optical hit-area expansion when controls are packed together. */
  expandHitSlop?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Shared icon-only control. Button owns press/ripple/accessibility behavior;
 * this component only standardizes the visual face and icon centering.
 */
export default memo(({
  name,
  size = Q_UI.touchSize,
  iconSize = 20,
  iconColor,
  variant = 'plain',
  selected = false,
  radius = Q_UI.radius.control,
  expandHitSlop = true,
  style,
  accessibilityLabel,
  accessibilityState,
  hitSlop,
  ...props
}: IconButtonProps) => {
  const theme = useTheme()
  const targetSize = Math.max(1, size)
  const targetPadding = Math.max(0, Math.ceil((Q_UI.touchSize - targetSize) / 2))
  const resolvedHitSlop = hitSlop ?? (expandHitSlop
    ? {
        top: targetPadding,
        right: targetPadding,
        bottom: targetPadding,
        left: targetPadding,
      }
    : 0)
  const hasSurface = variant !== 'plain' || selected
  const backgroundColor = selected
    ? theme['q-surface-tint']
    : variant === 'tonal'
      ? theme['q-surface-tint']
      : variant === 'outlined'
        ? theme['q-surface-base']
        : 'transparent'
  const borderColor = selected
    ? theme['q-accent']
    : variant === 'outlined'
      ? theme['q-outline']
      : 'transparent'
  const resolvedAccessibilityState = selected
    ? { ...accessibilityState, selected: true }
    : accessibilityState

  return (
    <Button
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={resolvedAccessibilityState}
      hitSlop={resolvedHitSlop}
      style={[
        styles.button,
        {
          width: targetSize,
          height: targetSize,
          minWidth: targetSize,
          minHeight: targetSize,
          borderRadius: radius,
          backgroundColor: hasSurface ? backgroundColor : 'transparent',
          borderColor,
          borderWidth: variant === 'outlined' || selected ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
    >
      <Icon
        accessible={false}
        name={name}
        rawSize={iconSize}
        color={iconColor ?? (selected ? theme['q-accent-text'] : theme['q-text-primary'])}
        style={styles.icon}
      />
    </Button>
  )
})

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 0,
  },
  icon: {
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
})
