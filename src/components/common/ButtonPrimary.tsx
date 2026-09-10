import { memo } from 'react'

import Button, { type BtnProps } from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

export interface ButtonProps extends BtnProps {
  size?: number
}

const CONTROL_HIT_SLOP = { top: 4, right: 4, bottom: 4, left: 4 } as const

export default memo(({ disabled, size = 14, onPress, children, style }: ButtonProps) => {
  const theme = useTheme()

  return (
    <Button
      style={[
        style,
        styles.button,
        {
          backgroundColor: theme['q-surface-tint'],
          borderColor: theme['c-primary-alpha-700'],
        },
      ]}
      hitSlop={CONTROL_HIT_SLOP}
      onPress={onPress}
      disabled={disabled}
    >
      <Text size={size} color={theme['q-accent-text']}>{children}</Text>
    </Button>
  )
})

const styles = createStyle({
  button: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
