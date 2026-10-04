import { memo } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import Skeleton, { useSkeletonPulse } from '@/components/common/Skeleton'
import { useI18n } from '@/lang'

// 列表首屏加载占位；尺寸与真实列表项一致，内容到达时不跳动。
export default memo(({ variant, rows, itemHeight }: {
  variant: 'song' | 'songlist'
  rows?: number
  itemHeight: number
}) => {
  const t = useI18n()
  const opacity = useSkeletonPulse()
  const count = rows ?? (variant == 'song' ? 10 : 7)

  return (
    <Animated.View accessible accessibilityLabel={t('list_loading')} style={{ opacity }}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[variant == 'song' ? styles.songRow : styles.songlistRow, { height: itemHeight, opacity: 1 - index * (0.6 / count) }]}>
          {variant == 'song'
            ? (
                <>
                  <View style={styles.sn}><Skeleton animated={false} width={14} height={10} /></View>
                  <View style={styles.info}>
                    <Skeleton animated={false} width={`${64 - (index % 4) * 9}%`} height={13} />
                    <Skeleton animated={false} width={`${38 - (index % 3) * 6}%`} height={9} style={styles.line} />
                  </View>
                  <Skeleton animated={false} width={30} height={9} style={styles.trailing} />
                </>
              )
            : (
                <>
                  <Skeleton animated={false} width={70} height={70} radius={12} />
                  <View style={styles.songlistInfo}>
                    <Skeleton animated={false} width={`${78 - (index % 3) * 12}%`} height={13} />
                    <Skeleton animated={false} width="42%" height={10} style={styles.line} />
                    <Skeleton animated={false} width="30%" height={9} style={styles.line} />
                  </View>
                </>
              )}
        </View>
      ))}
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  songRow: {
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sn: {
    width: 34,
    alignItems: 'center',
  },
  info: {
    flex: 1,
    paddingRight: 2,
  },
  trailing: {
    marginRight: 48,
  },
  songlistRow: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  songlistInfo: {
    flex: 1,
    paddingLeft: 14,
  },
  line: {
    marginTop: 8,
  },
})
