import { View } from 'react-native'

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
          ...styles.header,
          ...qSurfaceShadow,
          backgroundColor: theme['q-surface-raised'],
          borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.68)',
        }}
      >
        <Text
          style={styles.title}
          color={theme['q-text-primary']}
          size={17}
        >
          {title}
        </Text>
      </View>
      <View
        style={{
          ...styles.content,
          ...qSurfaceShadow,
          backgroundColor: theme['q-surface-base'],
          borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.54)',
        }}
      >
        {children}
      </View>
    </View>
  )
}


const styles = createStyle({
  container: {
    marginBottom: 18,
  },
  header: {
    minHeight: 48,
    paddingLeft: 16,
    paddingRight: 16,
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 0.5,
    borderRadius: 20,
  },
  title: {
    fontWeight: '700',
  },
  content: {
    borderWidth: 0.5,
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 6,
    overflow: 'hidden',
  },
})
