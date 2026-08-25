import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import HistorySearch, { type HistorySearchType } from './HistorySearch'
import HotSearch, { type HotSearchType } from './HotSearch'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { qFloatingShadow } from '@/theme/ui'
import DailyRecommend, { type DailyRecommendType } from './DailyRecommend'
import AccountConnect from './AccountConnect'

interface BlankViewProps {
  onSearch: (keyword: string) => void
  onFocusSearch: () => void
}
type Source = LX.OnlineSource | 'all'

export interface BlankViewType {
  show: (source: Source) => void
}

export default forwardRef<BlankViewType, BlankViewProps>(({ onSearch, onFocusSearch }, ref) => {
  const [visible, setVisible] = useState(false)
  const hotSearchRef = useRef<HotSearchType>(null)
  const historySearchRef = useRef<HistorySearchType>(null)
  const dailyRecommendRef = useRef<DailyRecommendType>(null)
  const sourceRef = useRef<Source>('all')
  const isShowHotSearch = useSettingValue('search.isShowHotSearch')
  const isShowHistorySearch = useSettingValue('search.isShowHistorySearch')
  const t = useI18n()
  const theme = useTheme()

  const handleShow = useCallback(() => {
    dailyRecommendRef.current?.show(sourceRef.current)
    hotSearchRef.current?.show(sourceRef.current)
    historySearchRef.current?.show()
  }, [])

  useEffect(() => {
    if (!visible) return
    const frameId = requestAnimationFrame(handleShow)
    return () => { cancelAnimationFrame(frameId) }
  }, [visible, isShowHotSearch, isShowHistorySearch, handleShow])

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
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View
              style={{
                ...styles.welcomeCard,
                ...qFloatingShadow,
                backgroundColor: theme['q-surface-raised'],
                borderColor: theme['q-outline'],
              }}
            >
              <View style={styles.welcomeCopy}>
                <Text style={styles.eyebrow} size={10} color={theme['q-accent-text']}>FOR YOU</Text>
                <Text style={styles.welcomeTitle} size={25} color={theme['q-text-primary']}>{t('search__welcome')}</Text>
                <Text style={styles.welcomeSubtitle} size={13} color={theme['q-text-secondary']}>{t('search_welcome_subtitle')}</Text>
              </View>
              <Button style={{ ...styles.searchAction, backgroundColor: theme['q-accent'] }} onPress={onFocusSearch}>
                <Icon name="search-2" color={theme['q-on-accent']} rawSize={18} />
              </Button>
            </View>
            <View style={styles.content}>
              <AccountConnect />
              <DailyRecommend ref={dailyRecommendRef} />
              { isShowHotSearch ? <HotSearch ref={hotSearchRef} onSearch={onSearch} /> : null }
              { isShowHistorySearch ? <HistorySearch ref={historySearchRef} onSearch={onSearch} /> : null }
            </View>
          </ScrollView>
        )
      : null

  )
})


const styles = createStyle({
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 32,
    paddingLeft: 16,
    paddingRight: 16,
  },
  content: {
    gap: 12,
  },
  welcomeCard: {
    minHeight: 126,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 26,
  },
  welcomeCopy: {
    flex: 1,
    paddingRight: 12,
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
  searchAction: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
})
