import { useEffect, useRef } from 'react'
import { Animated, Easing, Image, StyleSheet, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useNavActiveId } from '@/store/common/hook'
import { setNavActiveId } from '@/core/common'
import { useI18n } from '@/lang'
import commonState from '@/store/common/state'
import { backToSettingOverview, useSettingSection } from '@/store/setting/navigation'
import { useMotion } from '@/utils/useMotion'
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
  const motion = useMotion()
  const section = useSettingSection()
  const secondary = activeId == 'download' || activeId == 'nav_setting'
  const titleText = t(activeId == 'nav_setting' && section != 'overview' ? `setting_${section}` : activeId == 'nav_love' ? 'mobile_library' : activeId)
  const titleAnim = useRef(new Animated.Value(1)).current
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    titleAnim.stopAnimation()
    if (!motion) {
      titleAnim.setValue(1)
      return
    }
    titleAnim.setValue(0)
    Animated.timing(titleAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
    return () => { titleAnim.stopAnimation() }
  }, [motion, titleAnim, titleText])

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
        <Animated.View
          style={[
            styles.titleContainer,
            {
              opacity: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.36, 1] }),
              transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
            },
          ]}
        >
          <Text
            style={styles.title}
            size={23}
            color={theme['q-text-primary']}
            numberOfLines={1}
          >
            {titleText}
          </Text>
        </Animated.View>
        {activeId == 'nav_love' && <Button pressScale={0.92} accessibilityLabel={t('nav_setting')} style={styles.action} onPress={() => { setNavActiveId('nav_setting') }}><Icon name="setting" rawSize={22} color={theme['q-text-primary']} /></Button>}
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
    borderRadius: 8,
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '700',
  },
})
