import { StyleSheet, View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { qSurfaceShadow } from '@/theme/ui'


interface Props {
  title: string
  children: React.ReactNode | React.ReactNode[]
}

export default ({ title, children }: Props) => {
  const theme = useTheme()

  return (
    <View style={styles.container}>
      <View
        style={{
          ...styles.card,
          ...qSurfaceShadow,
          backgroundColor: theme['q-surface-raised'],
          borderColor: theme.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.62)',
        }}
      >
        <View style={styles.header}>
          <View style={{ ...styles.titleAccent, backgroundColor: theme['q-accent'] }} />
          <Text
            style={styles.title}
            color={theme['q-text-primary']}
            size={16}
          >
            {title}
          </Text>
        </View>
        <View style={styles.content}>
          {children}
        </View>
      </View>
    </View>
  )
}


const styles = createStyle({
  container: {
    marginBottom: 16,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 8,
  },
  titleAccent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  title: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  content: {
    paddingTop: 2,
  },
})
