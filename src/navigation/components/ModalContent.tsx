import { StyleSheet, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { qFloatingShadow } from '@/theme/ui'
// import { useWindowSize } from '@/utils/hooks'
const HEADER_HEIGHT = 4

interface Props {
  children: React.ReactNode
}


export default ({ children }: Props) => {
  const theme = useTheme()
  const lightEdge = theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.76)'
  const scrim = theme.isDark ? 'rgba(6,12,10,0.48)' : 'rgba(238,248,243,0.56)'

  return (
    <View style={{ ...styles.centeredView, backgroundColor: scrim }}>
      <View
        style={{
          ...styles.modalView,
          ...qFloatingShadow,
          backgroundColor: theme['q-surface-raised'],
          borderColor: lightEdge,
        }}
      >
        <View style={{ ...styles.header, backgroundColor: lightEdge }}></View>
        {children}
      </View>
    </View>
  )
}


const styles = createStyle({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '92%',
    maxWidth: 420,
    maxHeight: '78%',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    height: HEADER_HEIGHT,
  },
})
