import { Image, StyleSheet, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useNavActiveId } from '@/store/common/hook'
import { setNavActiveId } from '@/core/common'
import { useI18n } from '@/lang'
import commonState from '@/store/common/state'

const HEADER_CONTENT_HEIGHT = 56

const HeaderContent = () => {
  const theme = useTheme()
  const activeId = useNavActiveId()
  const t = useI18n()
  const secondary = activeId == 'download' || activeId == 'nav_setting'

  return (
    <View
      style={{
        ...styles.safeArea,
        backgroundColor: theme['q-surface-raised'],
        borderBottomColor: theme['q-outline'],
      }}
    >
      <View style={{ ...styles.container, height: HEADER_CONTENT_HEIGHT }}>
        {secondary
          ? <Button accessibilityLabel={t('back')} style={styles.action} onPress={() => { setNavActiveId(activeId == 'download' ? 'nav_love' : commonState.lastNavActiveId == 'nav_setting' ? 'nav_love' : commonState.lastNavActiveId) }}><Icon name="chevron-left" rawSize={22} color={theme['q-text-primary']} /></Button>
          : <Image source={require('../../../resources/images/q-music.png')} style={styles.logo} />}
        <Text
          style={styles.title}
          size={23}
          color={theme['q-text-primary']}
          numberOfLines={1}
        >
          {t(activeId == 'nav_love' ? 'mobile_library' : activeId)}
        </Text>
        {activeId != 'nav_search' && <Button accessibilityLabel={t('mobile_search_hint')} style={styles.action} onPress={() => { setNavActiveId('nav_search') }}><Icon name="search-2" rawSize={22} color={theme['q-text-primary']} /></Button>}
        {activeId != 'nav_setting' && <Button accessibilityLabel={t('nav_setting')} style={styles.action} onPress={() => { setNavActiveId('nav_setting') }}><Icon name="setting" rawSize={22} color={theme['q-text-primary']} /></Button>}
      </View>
    </View>
  )
}

export default () => {
  return <HeaderContent />
}

const styles = StyleSheet.create({
  action: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
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
