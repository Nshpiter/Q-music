import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { SETTINGS_SEARCH_ITEMS } from './searchItems'
import Section from './components/Section'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { selectSettingSection } from '@/store/setting/navigation'
import { Q_UI } from '@/theme/ui'
import { useInteractionMotion } from '@/utils/useMotion'

export default ({ id }: { id: string }) => {
  const t = useI18n()
  const theme = useTheme()
  const motion = useInteractionMotion()
  const entrance = useRef(new Animated.Value(motion ? 0 : 1)).current
  useEffect(() => {
    entrance.stopAnimation()
    if (!motion) {
      entrance.setValue(1)
      return
    }
    entrance.setValue(0)
    Animated.spring(entrance, { toValue: 1, ...Q_UI.motion.settle, overshootClamping: true, useNativeDriver: true }).start()
    return () => { entrance.stopAnimation() }
  }, [id, motion, entrance])
  const item = SETTINGS_SEARCH_ITEMS.find(item => item.id == id)
  if (!item) return null
  const Control = item.component
  return <Animated.View style={{
    opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  }}>
    {item.standalone ? <Control /> : <Section title={t(`setting_${item.section}`)}><Control /></Section>}
    <View style={styles.footer}>
      <Button
        pressScale={0.985}
        style={[styles.moreBtn, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]}
        onPress={() => { selectSettingSection(item.section) }}
      >
        <Text size={13} color={theme['q-accent-text']} style={styles.moreText}>{t('settings_search_more', { section: t(`setting_${item.section}`) })}</Text>
      </Button>
    </View>
  </Animated.View>
}

const styles = StyleSheet.create({
  footer: { paddingTop: 4, paddingBottom: 12 },
  moreBtn: {
    minHeight: Q_UI.touchSize,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  moreText: { fontWeight: '600' },
})
