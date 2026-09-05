import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { type Source, type InitState } from '@/store/hotSearch/state'
import Button from '@/components/common/Button'
import { getList } from '@/core/hotSearch'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { Q_TOUCH_HIT_SLOP, qSurfaceShadow } from '@/theme/ui'
import hotSearchActions from '@/store/hotSearch/action'
import { Icon } from '@/components/common/Icon'


interface ListProps {
  onSearch: (keyword: string) => void
}
export interface HotSearchType {
  show: (source: Source) => void
}


export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

const ListItem = ({ keyword, onSearch }: {
  keyword: string
  onSearch: (keyword: string) => void
}) => {
  const theme = useTheme()
  return (
    <Button
      accessibilityLabel={keyword}
      hitSlop={Q_TOUCH_HIT_SLOP}
      style={{
        ...styles.button,
        backgroundColor: theme['q-surface-tint'],
        borderColor: theme['c-primary-alpha-700'],
      }}
      onPress={() => { onSearch(keyword) }}
    >
      <Text color={theme['q-accent-text']} size={13}>{keyword}</Text>
    </Button>
  )
}

export default forwardRef<HotSearchType, ListProps>((props, ref) => {
  // const [listType, setListType] = useState<SearchState['searchType']>('music')
  // const listRef = useRef<MusicListType>(null)
  const [list, setList] = useState<List>([])
  const t = useI18n()
  const theme = useTheme()
  const [loading, setLoading] = useState(false)
  const sourceRef = useRef<Source>('kw')
  const requestIdRef = useRef(0)

  const isUnmountedRef = useRef(false)
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  const load = useCallback(async(source: Source, force = false) => {
    sourceRef.current = source
    const requestId = ++requestIdRef.current
    if (force) hotSearchActions.clearList(source)
    setLoading(true)
    try {
      const nextList = await getList(source)
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      setList(nextList)
    } catch {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      setList([])
    } finally {
      if (!isUnmountedRef.current && requestId == requestIdRef.current) setLoading(false)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show(source) {
      void load(source)
    },
  }), [load])

  return (
    <View
      style={{
        ...styles.card,
        ...qSurfaceShadow,
        backgroundColor: theme['q-surface-raised'],
        borderColor: theme['q-outline'],
      }}
    >
      <View style={styles.titleContent}>
        <Text style={styles.title} color={theme['q-text-primary']} size={14}>{t('search_hot_search')}</Text>
        <Button accessibilityLabel={t('search_hot_search_refresh')} hitSlop={Q_TOUCH_HIT_SLOP} style={styles.refreshBtn} onPress={() => { void load(sourceRef.current, true) }} disabled={loading}>
          <Icon accessible={false} name="available_updates" color={theme['q-text-secondary']} size={15} />
          <Text color={theme['q-text-secondary']} size={12}>{t('search_hot_search_refresh')}</Text>
        </Button>
      </View>
      {loading && !list.length
        ? <View style={styles.state}><ActivityIndicator color={theme['q-accent']} /><Text color={theme['q-text-secondary']} size={12}>{t('search_hot_search_loading')}</Text></View>
        : list.length
          ? <View style={styles.list}>{list.map(keyword => <ListItem keyword={keyword} key={keyword} onSearch={props.onSearch} />)}</View>
          : <Text style={styles.empty} color={theme['q-text-secondary']} size={12}>{t('search_hot_search_empty')}</Text>}
    </View>
  )
})


const styles = createStyle({
  card: {
    paddingTop: 16,
    paddingBottom: 16,
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
  refreshBtn: {
    minHeight: 40,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  state: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  empty: {
    minHeight: 72,
    paddingTop: 26,
    textAlign: 'center',
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  button: {
    textAlign: 'center',
    minHeight: 40,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 9,
    paddingBottom: 9,
    borderWidth: 1,
    borderRadius: 20,
    marginRight: 8,
    marginTop: 8,
    justifyContent: 'center',
  },
})
