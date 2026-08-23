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
  const sourceRef = useRef<Source>('kw')
  const isShowHotSearch = useSettingValue('search.isShowHotSearch')
  const isShowHistorySearch = useSettingValue('search.isShowHistorySearch')
  const t = useI18n()
  const theme = useTheme()

  const handleShow = useCallback(() => {
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
              <View style={{ ...styles.welcomeIcon, backgroundColor: theme['q-accent'] }}>
                <Icon name="search-2" color={theme['q-on-accent']} rawSize={25} />
              </View>
              <Text style={styles.welcomeTitle} size={24} color={theme['q-text-primary']}>{t('search__welcome')}</Text>
              <Text style={styles.welcomeSubtitle} size={13} color={theme['q-text-secondary']}>{t('search_welcome_subtitle')}</Text>
              <Button
                style={{ ...styles.searchAction, backgroundColor: theme['q-accent'] }}
                onPress={onFocusSearch}
              >
                <Icon name="search-2" color={theme['q-on-accent']} rawSize={16} />
                <Text size={13} color={theme['q-on-accent']}>{t('search_welcome_action')}</Text>
              </Button>
            </View>
            <View style={styles.content}>
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
    paddingTop: 18,
    paddingBottom: 28,
    paddingLeft: 14,
    paddingRight: 14,
  },
  content: {
    gap: 12,
  },
  welcomeCard: {
    paddingTop: 26,
    paddingBottom: 24,
    paddingLeft: 22,
    paddingRight: 22,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 24,
  },
  welcomeIcon: {
    width: 58,
    height: 58,
    marginBottom: 16,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  welcomeSubtitle: {
    maxWidth: 300,
    marginTop: 8,
    lineHeight: 20,
    textAlign: 'center',
  },
  searchAction: {
    minHeight: 40,
    marginTop: 20,
    paddingLeft: 18,
    paddingRight: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
})
