import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import HotSearch, { type HotSearchType } from './HotSearch'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { setNavActiveId } from '@/core/common'
import DailyRecommend from './DailyRecommend'
import { useDockInset } from '@/components/common/DockInset'
import { pushMusicAccountScreen } from '@/navigation/navigation'
import commonState from '@/store/common/state'

interface BlankViewProps {
  onSearch: (keyword: string) => void
}
type Source = LX.OnlineSource | 'all'

export interface BlankViewType {
  show: (source: Source) => void
}

export default forwardRef<BlankViewType, BlankViewProps>(({ onSearch }, ref) => {
  const [visible, setVisible] = useState(false)
  const hotSearchRef = useRef<HotSearchType>(null)
  const sourceRef = useRef<Source>('all')
  const isShowHotSearch = useSettingValue('search.isShowHotSearch')
  const t = useI18n()
  const theme = useTheme()
  const dockInset = useDockInset()

  const handleShow = useCallback(() => {
    hotSearchRef.current?.show(sourceRef.current)
  }, [])

  useEffect(() => {
    if (!visible) return
    const frameId = requestAnimationFrame(handleShow)
    return () => { cancelAnimationFrame(frameId) }
  }, [visible, isShowHotSearch, handleShow])

  useImperativeHandle(ref, () => ({
    show(source) {
      sourceRef.current = source
      if (visible) requestAnimationFrame(handleShow)
      else setVisible(true)
    },
  }), [visible, handleShow])

  return (
    visible
      ? (
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + dockInset }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View
              style={{
                ...styles.welcomeCard,
              }}
            >
              <View style={styles.welcomeCopy}>
                <Text style={styles.eyebrow} size={10} color={theme['q-accent-text']}>Q MUSIC / FOR YOU</Text>
                <Text style={styles.welcomeTitle} size={25} color={theme['q-text-primary']}>{t('search__welcome')}</Text>
                <Text style={styles.welcomeSubtitle} size={13} color={theme['q-text-secondary']}>{t('search_welcome_subtitle')}</Text>
              </View>
            </View>
            <View style={styles.shortcuts}>
              {([
                { id: 'nav_love', icon: 'love' },
                { id: 'nav_top', icon: 'leaderboard' },
                { id: 'nav_songlist', icon: 'album' },
              ] as const).map(item => (
                <Button key={item.id} accessibilityLabel={t(item.id)} style={styles.shortcut} onPress={() => { setNavActiveId(item.id) }}>
                  <View style={{ ...styles.shortcutIcon, backgroundColor: theme['q-surface-tint'] }}><Icon accessible={false} name={item.icon} rawSize={21} color={theme['q-accent-text']} /></View>
                  <Text size={12} color={theme['q-text-primary']}>{t(item.id)}</Text>
                </Button>
              ))}
              <Button accessibilityLabel={t('account_lists_entry')} style={styles.shortcut} onPress={() => { if (commonState.componentIds.home) pushMusicAccountScreen(commonState.componentIds.home) }}>
                <View style={{ ...styles.shortcutIcon, backgroundColor: theme['q-surface-tint'] }}><Icon accessible={false} name="available_updates" rawSize={21} color={theme['q-accent-text']} /></View>
                <Text size={12} color={theme['q-text-primary']}>{t('account_lists_entry')}</Text>
              </Button>
            </View>
            <View style={styles.content}>
              { isShowHotSearch ? <HotSearch ref={hotSearchRef} onSearch={onSearch} /> : null }
              <DailyRecommend />
            </View>
          </ScrollView>
        )
      : null

  )
})


const styles = createStyle({
  scrollContent: {
    paddingTop: 6,
    paddingBottom: 32,
    paddingLeft: 16,
    paddingRight: 16,
  },
  content: {
    gap: 18,
  },
  shortcuts: { flexDirection: 'row', gap: 4, marginBottom: 22 },
  shortcut: { flex: 1, minHeight: 72, gap: 8, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  shortcutIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
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
