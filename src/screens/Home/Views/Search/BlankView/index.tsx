import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { ScrollView, View } from 'react-native'
import DailyRecommend from './DailyRecommend'
import { useDockInset } from '@/components/common/DockInset'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'

interface BlankViewProps {
  onSearch: (keyword: string) => void
}
type Source = LX.OnlineSource | 'all'

export interface BlankViewType {
  show: (source: Source) => void
}

export default forwardRef<BlankViewType, BlankViewProps>((_props, ref) => {
  const [visible, setVisible] = useState(false)
  const t = useI18n()
  const theme = useTheme()
  const dockInset = useDockInset()
  const { wide } = useAdaptiveLayout()

  useImperativeHandle(ref, () => ({
    show() { setVisible(true) },
  }), [])

  return (
    visible
      ? (
          <ScrollView contentContainerStyle={[styles.scrollContent, wide && styles.wideContent, { paddingBottom: 32 + dockInset }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.welcomeCard}>
              <View style={styles.welcomeCopy}>
                <Text style={styles.eyebrow} size={10} color={theme['q-accent-text']}>Q MUSIC / FOR YOU</Text>
                <Text style={styles.welcomeTitle} size={25} color={theme['q-text-primary']}>{t('search__welcome')}</Text>
                <Text style={styles.welcomeSubtitle} size={13} color={theme['q-text-secondary']}>{t('search_welcome_subtitle')}</Text>
              </View>
            </View>
            <View style={styles.content}>
              <DailyRecommend />
            </View>
          </ScrollView>
        )
      : null

  )
})


const styles = createStyle({
  wideContent: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 24 },
  scrollContent: {
    paddingTop: 6,
    paddingBottom: 32,
    paddingLeft: 16,
    paddingRight: 16,
  },
  content: {
    gap: 18,
  },
  welcomeCard: {
    minHeight: 82,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeCopy: {
    flex: 1,
  },
  eyebrow: {
    marginBottom: 6,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  welcomeTitle: {
    fontWeight: '700',
  },
  welcomeSubtitle: {
    marginTop: 7,
    lineHeight: 20,
  },
})
