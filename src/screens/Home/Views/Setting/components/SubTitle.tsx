import { memo } from 'react'

import { View } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'

export default memo(({ title, children }: {
  title: string
  children: React.ReactNode | React.ReactNode[]
}) => {
  const theme = useTheme()

  return (
    <View style={styles.container}>
      <Text style={styles.title} color={theme['q-text-secondary']} size={12}>{title}</Text>
      {children}
    </View>
  )
})


const styles = createStyle({
  container: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    marginBottom: 20,
  },
  title: {
    marginBottom: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
})
