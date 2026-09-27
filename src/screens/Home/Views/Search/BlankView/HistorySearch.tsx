import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { View } from 'react-native'
import { type InitState } from '@/store/hotSearch/state'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import IconButton from '@/components/common/IconButton'
import { Q_TOUCH_HIT_SLOP } from '@/theme/ui'
import { Icon } from '@/components/common/Icon'


export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

const ListItem = ({ keyword, onSearch, onRemove }: {
  keyword: string
  onSearch: (keyword: string) => void
  onRemove: (keyword: string) => void
}) => {
  const theme = useTheme()
  return <View style={[styles.chip, { backgroundColor: theme['q-surface-tint'], borderColor: theme['c-primary-alpha-700'] }]}>
    <Button accessibilityLabel={keyword} style={styles.chipSearch} onPress={() => { onSearch(keyword) }}>
      <Text color={theme['q-accent-text']} size={13} numberOfLines={1}>{keyword}</Text>
    </Button>
    <Button accessibilityLabel={`${global.i18n.t('delete')} ${keyword}`} hitSlop={Q_TOUCH_HIT_SLOP} style={styles.chipRemove} onPress={() => { onRemove(keyword) }}>
      <Icon accessible={false} name="close" rawSize={13} color={theme['q-text-secondary']} />
    </Button>
  </View>
}


interface HistorySearchProps {
  onSearch: (keyword: string) => void
}
export interface HistorySearchType {
  show: () => void
}

export default forwardRef<HistorySearchType, HistorySearchProps>((props, ref) => {
  const [list, setList] = useState<List>([])
  const [expanded, setExpanded] = useState(false)
  const isUnmountedRef = useRef(false)
  const t = useI18n()
  const theme = useTheme()

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show() {
      setExpanded(false)
      void getSearchHistory().then((list) => {
        if (isUnmountedRef.current) return
        setList(list)
      }).catch(() => { if (!isUnmountedRef.current) setList([]) })
    },
  }), [])

  const handleClear = () => {
    clearHistoryList()
    setList([])
    setExpanded(false)
  }

  const handleRemove = useCallback((keyword: string) => {
    const index = list.indexOf(keyword)
    if (index < 0) return
    removeHistoryWord(index)
    setList(list.filter(item => item != keyword))
  }, [list])

  return (
    <View
      style={{
        ...styles.card,
        backgroundColor: theme['c-content-background'],
        borderColor: theme['q-outline'],
      }}
    >
      <View style={styles.titleContent}>
        <Text style={styles.title} color={theme['q-text-primary']} size={14}>{t('search_history_search')}</Text>
        {list.length ? <IconButton
          accessibilityLabel={`${t('delete')} ${t('search_history_search')}`}
          name="eraser"
          size={40}
          iconSize={16}
          iconColor={theme['q-text-secondary']}
          variant="tonal"
          onPress={handleClear}
          style={styles.titleBtn}
        /> : null}
      </View>
      {!list.length ? <Text size={12} color={theme['q-text-secondary']} style={{ lineHeight: 20, paddingVertical: 8 }}>{t('search_history_empty')}</Text> : null}
      <View style={styles.list}>
        {(expanded ? list : list.slice(0, 6)).map(keyword => <ListItem keyword={keyword} key={keyword} onSearch={props.onSearch} onRemove={handleRemove} />)}
      </View>
      {list.length > 6 ? <Button accessibilityLabel={t(expanded ? 'search_history_less' : 'search_history_more')} style={styles.more} onPress={() => { setExpanded(value => !value) }}>
        <Text size={12} color={theme['q-accent-text']}>{t(expanded ? 'search_history_less' : 'search_history_more')}</Text>
        <Icon accessible={false} name="chevron-down" rawSize={15} color={theme['q-accent-text']} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </Button> : null}
    </View>
  )
})


const styles = createStyle({
  card: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    borderWidth: 1,
    borderRadius: 20,
  },
  titleContent: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '700',
  },
  titleBtn: {
    borderRadius: 12,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    maxWidth: '100%',
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipSearch: {
    maxWidth: 210,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  chipRemove: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  more: { height: 36, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
})
