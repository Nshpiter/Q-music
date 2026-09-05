import { memo } from 'react'
import type { PressableStateCallbackType } from 'react-native'

import Button, { type BtnProps } from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { Q_UI, qSurfaceShadow } from '@/theme/ui'

type ButtonProps = BtnProps

export default memo(({ disabled, onPress, children, style, ...props }: ButtonProps) => {
  const theme = useTheme()
  const buttonStyle = typeof style === 'function'
    ? (state: PressableStateCallbackType) => [
        styles.button,
        qSurfaceShadow,
        {
          backgroundColor: theme['q-surface-tint'],
          borderColor: theme['c-primary-alpha-700'],
        },
        style(state),
      ]
    : [
        styles.button,
        qSurfaceShadow,
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
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text} size={14} color={theme['q-accent-text']}>{children}</Text>
    </Button>
  )
})

const styles = createStyle({
  button: {
    minHeight: Q_UI.touchSize,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
})
