import { memo } from 'react'
import type { PressableStateCallbackType } from 'react-native'

import Button, { type BtnProps } from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { Q_UI } from '@/theme/ui'

export interface ButtonProps extends BtnProps {
  size?: number
}

export default memo(({ disabled, size = 14, onPress, children, style, ...props }: ButtonProps) => {
  const theme = useTheme()
  const buttonStyle = typeof style === 'function'
    ? (state: PressableStateCallbackType) => [
        styles.button,
        {
          backgroundColor: theme['q-surface-tint'],
          borderColor: theme['c-primary-alpha-700'],
        },
        style(state),
      ]
    : [
        styles.button,
        {
          backgroundColor: theme['q-surface-tint'],
          borderColor: theme['c-primary-alpha-700'],
        },
        style,
      ]

  return (
    <Button
      {...props}
      style={buttonStyle}
      hitSlop={props.hitSlop}
      onPress={onPress}
      disabled={disabled}
    >
      <Text size={size} color={theme['q-accent-text']}>{children}</Text>
    </Button>
  )
})

const styles = createStyle({
  button: {
    minWidth: Q_UI.touchSize,
    minHeight: Q_UI.touchSize,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: Q_UI.radius.control,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
