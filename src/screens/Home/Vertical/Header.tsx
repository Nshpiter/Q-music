import { Image, StyleSheet, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useNavActiveId } from '@/store/common/hook'
import { setNavActiveId } from '@/core/common'
import { useI18n } from '@/lang'
import commonState from '@/store/common/state'
import { backToSettingOverview, useSettingSection } from '@/store/setting/navigation'
import type { SettingScreenIds } from '../Views/Setting/Main'

const HEADER_CONTENT_HEIGHT = 56

// 页头属于当前设置场景，和内容一起参与返回预览，不能留在屏幕顶端提前换标题。
export const SettingHeader = ({ section }: { section: SettingScreenIds }) => {
  const theme = useTheme()
  const t = useI18n()
  return <View style={[styles.safeArea, { backgroundColor: theme['c-content-background'], borderBottomColor: theme['q-outline'] }]}>
    <View style={[styles.container, { height: HEADER_CONTENT_HEIGHT }]}>
      <Button pressScale={0.92} accessibilityLabel={t('back')} style={styles.action} onPress={() => {
        if (section != 'overview' && backToSettingOverview()) return
        setNavActiveId(commonState.lastNavActiveId == 'nav_setting' ? 'nav_love' : commonState.lastNavActiveId)
      }}><Icon name="chevron-left" rawSize={22} color={theme['q-text-primary']} /></Button>
      <Text style={styles.title} size={23} color={theme['q-text-primary']} numberOfLines={1}>{t(section == 'overview' ? 'nav_setting' : `setting_${section}`)}</Text>
    </View>
  </View>
}

const HeaderContent = () => {
  const theme = useTheme()
  const activeId = useNavActiveId()
  const t = useI18n()
  const section = useSettingSection()
  const secondary = activeId == 'download' || activeId == 'nav_setting'
  const handleBack = () => {
    if (activeId == 'nav_setting' && backToSettingOverview()) return
    setNavActiveId(activeId == 'download' ? 'nav_love' : commonState.lastNavActiveId == 'nav_setting' ? 'nav_love' : commonState.lastNavActiveId)
  }

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
          ? <Button pressScale={0.92} accessibilityLabel={t('back')} style={styles.action} onPress={handleBack}><Icon name="chevron-left" rawSize={22} color={theme['q-text-primary']} /></Button>
          : <Image source={require('../../../resources/images/q-music.png')} style={styles.logo} />}
        <Text
          style={styles.title}
          size={23}
          color={theme['q-text-primary']}
          numberOfLines={1}
        >
          {t(activeId == 'nav_setting' && section != 'overview' ? `setting_${section}` : activeId == 'nav_love' ? 'mobile_library' : activeId)}
        </Text>
        {activeId == 'nav_love' && <Button accessibilityLabel={t('nav_setting')} style={styles.action} onPress={() => { setNavActiveId('nav_setting') }}><Icon name="setting" rawSize={22} color={theme['q-text-primary']} /></Button>}
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
