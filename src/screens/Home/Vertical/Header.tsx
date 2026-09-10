import { Image, StyleSheet, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'

const HEADER_CONTENT_HEIGHT = 56

const HeaderContent = () => {
  const theme = useTheme()

  return (
    <View
      style={{
        ...styles.safeArea,
        backgroundColor: theme['q-surface-raised'],
        borderBottomColor: theme['q-outline'],
      }}
    >
      <View style={{ ...styles.container, height: HEADER_CONTENT_HEIGHT }}>
        <Image source={require('../../../resources/images/q-music.png')} style={styles.logo} />
        <Text
          style={styles.title}
          size={17}
          color={theme['q-text-primary']}
          numberOfLines={1}
        >
          Q-music
        </Text>
      </View>
    </View>
  )
}

export default () => {
  return <HeaderContent />
}

const styles = StyleSheet.create({
  safeArea: {
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  logo: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  title: {
    flex: 1,
    fontWeight: '700',
  },
})
