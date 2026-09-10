import { memo } from 'react'
import { Image, StyleSheet, View } from 'react-native'

import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const txIcon = require('@/resources/images/sources/tx.png')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wyIcon = require('@/resources/images/sources/wy.png')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const kgIcon = require('@/resources/images/sources/kg.png')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const kwIcon = require('@/resources/images/sources/kw.png')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mgIcon = require('@/resources/images/sources/mg.png')

/** 平台官方图标映射；无图标的源回退为字母缩写徽章 */
const SOURCE_ICONS: Partial<Record<LX.OnlineSource, number>> = {
  tx: txIcon,
  wy: wyIcon,
  kg: kgIcon,
  kw: kwIcon,
  mg: mgIcon,
}

const DEFAULT_SIZE = 15

export default memo(({ source, size = DEFAULT_SIZE }: { source: string, size?: number }) => {
  const theme = useTheme()
  const icon = SOURCE_ICONS[source as LX.OnlineSource]

  if (icon) {
    return (
      <View style={styles.container}>
        <Image source={icon} style={{ width: size, height: size, borderRadius: size / 4 }} />
      </View>
    )
  }

  return (
    <View
      style={{
        ...styles.fallback,
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: theme['q-surface-tint'],
      }}
    >
      <Text size={8} color={theme['q-accent-text']}>{source.slice(0, 2).toUpperCase()}</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
