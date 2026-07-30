import { memo, useMemo } from 'react'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'
import { View } from 'react-native'

const styles = createStyle({
  badge: {
    minHeight: 16,
    paddingLeft: 5,
    paddingRight: 5,
    marginRight: 5,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  },
  text: {
    fontWeight: '700',
    lineHeight: 13,
  },
})

export type BadgeType = 'normal' | 'secondary' | 'tertiary'

const withAlpha = (color: string, alpha: number) => {
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1]
  if (hex) {
    return `rgba(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)}, ${alpha})`
  }

  const channels = color.match(/[\d.]+/g)
  return channels && channels.length >= 3
    ? `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`
    : color
}

export default memo(({ type = 'normal', children }: {
  type?: BadgeType
  children: string
}) => {
  const theme = useTheme()
  const colors = useMemo(() => {
    const colors = { textColor: '', backgroundColor: '' }
    switch (type) {
      case 'normal':
        colors.textColor = theme['c-badge-primary']
        break
      case 'secondary':
        colors.textColor = theme['c-badge-secondary']
        break
      case 'tertiary':
        colors.textColor = theme['c-badge-tertiary']
        break
    }
    colors.backgroundColor = withAlpha(colors.textColor, theme.isDark ? 0.22 : 0.12)
    return colors
  }, [type, theme])

  return (
    <View
      style={{
        ...styles.badge,
        backgroundColor: colors.backgroundColor,
      }}
    >
      <Text style={styles.text} size={9} color={colors.textColor}>{children}</Text>
    </View>
  )
})

