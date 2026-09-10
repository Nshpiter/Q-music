import { memo } from 'react'

import { View } from 'react-native'

import CheckBox, { type CheckBoxProps } from '@/components/common/CheckBox'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'


export default memo((props: CheckBoxProps) => {
  const theme = useTheme()
  const active = Boolean(props.check)

  return (
    <View style={styles.container}>
      <View
        style={{
          ...styles.row,
          backgroundColor: active ? theme['q-surface-tint'] : 'transparent',
        }}
      >
        <CheckBox {...props} />
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    paddingLeft: 10,
    paddingRight: 10,
    marginBottom: 4,
  },
  row: {
    borderRadius: 12,
    minHeight: 42,
    justifyContent: 'center',
  },
})

