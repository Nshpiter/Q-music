import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { sortSearchQuality, type SearchSort } from '@/utils/searchQuality'
import OnlineList, { type OnlineListType, type OnlineListProps } from '@/components/OnlineList'
import { search } from '@/core/search/music'
import searchMusicState, { type Source } from '@/store/search/music/state'

// export type MusicListProps = Pick<OnlineListProps,
// 'onLoadMore'
// | 'onPlayList'
// | 'onRefresh'
// >

export interface MusicListType {
  loadList: (text: string, source: Source) => void
}

export default forwardRef<MusicListType, {}>((props, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const [sortMode, setSortMode] = useState<SearchSort>('relevance')
  const [aggregate, setAggregate] = useState(false)
  const sortRef = useRef<SearchSort>('relevance')
  const raw = useRef<LX.Music.MusicInfoOnline[]>([])
  const showResults = (list: LX.Music.MusicInfoOnline[], append: boolean, all: boolean) => {
    raw.current = list
    listRef.current?.setList(sortSearchQuality(list, searchInfoRef.current.text, all ? sortRef.current : 'relevance'), append, all)
  }
  const chooseSort = (mode: SearchSort) => { sortRef.current = mode; setSortMode(mode); showResults(raw.current, false, aggregate) }
  const listRef = useRef<OnlineListType>(null)
  const searchInfoRef = useRef<{ text: string, source: Source }>({ text: '', source: 'kw' })
  const isUnmountedRef = useRef(false)
  const requestIdRef = useRef(0)
  useImperativeHandle(ref, () => ({
    async loadList(text, source) {
      const requestId = ++requestIdRef.current
      searchInfoRef.current = { text, source }
      setAggregate(source == 'all')
      // const listDetailInfo = searchMusicState.listDetailInfo
      showResults([], false, source == 'all')
      if (searchMusicState.searchText == text && searchMusicState.source == source && searchMusicState.listInfos[searchMusicState.source]!.list.length) {
        requestAnimationFrame(() => {
          if (isUnmountedRef.current || requestId != requestIdRef.current) return
          showResults(searchMusicState.listInfos[searchMusicState.source]!.list, false, source == 'all')
          listRef.current?.setStatus(searchMusicState.listInfos[source]!.maxPage <= searchMusicState.listInfos[source]!.page ? 'end' : 'idle')
        })
      } else {
        listRef.current?.setStatus('loading')
        const page = 1
        return search(text, page, source).then((list) => {
          // const result = setListInfo(listDetail, id, page)
          if (isUnmountedRef.current || requestId != requestIdRef.current) return
          requestAnimationFrame(() => {
            if (isUnmountedRef.current || requestId != requestIdRef.current) return
            showResults(list, false, source == 'all')
            listRef.current?.setStatus(searchMusicState.listInfos[source]!.maxPage <= page ? 'end' : 'idle')
          })
        }).catch(() => {
          if (isUnmountedRef.current || requestId != requestIdRef.current) return
          listRef.current?.setStatus('error')
        })
      }
    },
  }), [])

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])


  const handleRefresh: OnlineListProps['onRefresh'] = () => {
    const requestId = ++requestIdRef.current
    const page = 1
    const { text, source } = searchInfoRef.current
    listRef.current?.setStatus('refreshing')
    search(text, page, source).then((list) => {
      // const result = setListInfo(listDetail, searchMusicState.listDetailInfo.id, page)
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      showResults(list, false, source == 'all')
      listRef.current?.setStatus(searchMusicState.listInfos[source]!.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      listRef.current?.setStatus('error')
    })
  }
  const handleLoadMore: OnlineListProps['onLoadMore'] = () => {
    const requestId = ++requestIdRef.current
    listRef.current?.setStatus('loading')
    const { text, source } = searchInfoRef.current
    const info = searchMusicState.listInfos[source]!
    const page = info?.list.length ? info.page + 1 : 1
    search(text, page, source).then((list) => {
      // const result = setListInfo(listDetail, searchMusicState.listDetailInfo.id, page)
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      showResults(list, true, source == 'all')
      listRef.current?.setStatus(info.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      listRef.current?.setStatus('error')
    })
  }

  return <View style={{ flex: 1 }}>
    {aggregate ? <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>{(['relevance', 'quality'] as const).map(mode => <Button key={mode} accessibilityState={{ selected: sortMode == mode }} onPress={() => { chooseSort(mode) }} style={{ minHeight: 40, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: mode == sortMode ? theme['q-surface-tint'] : 'transparent' }}><Text size={12} color={mode == sortMode ? theme['q-accent-text'] : theme['q-text-secondary']}>{t(mode == 'quality' ? 'search_sort_quality' : 'search_sort_relevance')}</Text></Button>)}</View>
      <Text size={10} color={theme['q-text-secondary']}>{t('search_sort_tip')}</Text>
    </View> : null}
    <OnlineList
    ref={listRef}
    onRefresh={handleRefresh}
    onLoadMore={handleLoadMore}
    checkHomePagerIdle
  /></View>
})

