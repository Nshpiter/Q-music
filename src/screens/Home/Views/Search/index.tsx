import { useRef, useEffect, useState, useCallback } from 'react'
import { type LayoutChangeEvent, Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native'

// import music from '@/utils/musicSdk'
// import InsetShadow from 'react-native-inset-shadow'
// import TipList from './components/TipList'
// import MusicList from './components/MusicList'
import HeaderBar, { type HeaderBarProps, type HeaderBarType } from './HeaderBar'
import searchState, { type SearchType } from '@/store/search/state'
import searchActions from '@/store/search/action'
import searchMusicState from '@/store/search/music/state'
import searchSonglistState from '@/store/search/songlist/state'
import { getSearchSetting, saveSearchSetting } from '@/utils/data'
import { createStyle } from '@/utils/tools'
import TipList, { type TipListType } from './TipList'
import List, { type ListType } from './List'
import { addHistoryWord } from '@/core/search/search'
import SearchTypeSelector from './SearchTypeSelector'
import { useTheme } from '@/store/theme/hook'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import commonState from '@/store/common/state'
import HotSearch, { type HotSearchType } from './BlankView/HotSearch'
import { useNavActiveId } from '@/store/common/hook'
import HistorySearch, { type HistorySearchType } from './BlankView/HistorySearch'
import { useSettingValue } from '@/store/setting/hook'
import { onSearchRequest, takeSearchRequest, type SearchNavigationRequest } from '@/core/search/navigation'
import RelatedList from './RelatedList'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useI18n } from '@/lang'
import { useDockInset } from '@/components/common/DockInset'


interface SearchInfo {
  temp_source: LX.OnlineSource
  source: LX.OnlineSource | 'all'
  searchType: 'music' | 'songlist'
}

const getAvailableSources = (type: SearchType) => type == 'music' ? searchMusicState.sources : searchSonglistState.sources
const normalizeSource = (type: SearchType, source: SearchInfo['source']) => {
  const sources = getAvailableSources(type)
  if ((sources as readonly string[]).includes(source)) return source
  return (sources as ReadonlyArray<SearchInfo['source']>).includes('all') ? 'all' : sources[0]
}

export default () => {
  const theme = useTheme()
  const dockInset = useDockInset()
  const t = useI18n()
  const [related, setRelated] = useState<SearchNavigationRequest['related']>()
  const [searchType, setSearchType] = useState<SearchType>('music')
  const [hasQuery, setHasQuery] = useState(!!searchState.searchText.trim())
  const [hasDraft, setHasDraft] = useState(false)
  const [historyVisible, setHistoryVisible] = useState(false)
  const activeId = useNavActiveId()
  const hotSearchRef = useRef<HotSearchType>(null)
  const isShowHotSearch = useSettingValue('search.isShowHotSearch')
  const isShowHistorySearch = useSettingValue('search.isShowHistorySearch')
  const showSuggestions = isShowHistorySearch || isShowHotSearch
  const headerBarRef = useRef<HeaderBarType>(null)
  const historyRef = useRef<HistorySearchType>(null)
  const focusedRef = useRef(false)
  const searchTipListRef = useRef<TipListType>(null)
  const listRef = useRef<ListType>(null)
  const layoutHeightRef = useRef<number>(0)
  const searchInfo = useRef<SearchInfo>({ temp_source: 'kw', source: 'kw', searchType: 'music' })
  const showTipTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const revision = useRef(0)
  const externalTypeChange = useRef(false)

  useEffect(() => {
    let mounted = true
    const initialRevision = revision.current
    void getSearchSetting().then(info => {
      // 自动搜索或用户操作优先，迟到的偏好读取不能把来源和关键词覆盖回去。
      if (!mounted || revision.current != initialRevision) return
      searchInfo.current.temp_source = info.temp_source
      searchInfo.current.source = normalizeSource(info.type, info.source)
      searchInfo.current.searchType = info.type
      setSearchType(info.type)
      switch (info.type) {
        case 'music':
          headerBarRef.current?.setSourceList(searchMusicState.sources, searchInfo.current.source)
          break
        case 'songlist':
          headerBarRef.current?.setSourceList(searchSonglistState.sources, searchInfo.current.source)
          break
      }
      headerBarRef.current?.setText(searchState.searchText)
      listRef.current?.loadList(searchState.searchText, searchInfo.current.source, searchInfo.current.searchType)
    })

    const handleTypeChange = (type: SearchType) => {
      revision.current++
      setRelated(undefined)
      setSearchType(type)
      setHasQuery(!!searchState.searchText.trim())
      searchInfo.current.searchType = type
      const source = normalizeSource(type, searchInfo.current.source)
      searchInfo.current.source = source
      headerBarRef.current?.setSourceList(getAvailableSources(type), source)
      if (externalTypeChange.current) return
      void saveSearchSetting({ type, source })
      listRef.current?.loadList(searchState.searchText, source, type)
    }
    global.app_event.on('searchTypeChanged', handleTypeChange)

    return () => {
      mounted = false
      global.app_event.off('searchTypeChanged', handleTypeChange)
      if (showTipTimeoutRef.current) clearTimeout(showTipTimeoutRef.current)
    }
  }, [])


  const handleLayout = (e: LayoutChangeEvent) => {
    layoutHeightRef.current = e.nativeEvent.layout.height
  }

  const handleSourceChange: HeaderBarProps['onSourceChange'] = (source) => {
    revision.current++
    setRelated(undefined)
    setHasQuery(!!searchState.searchText.trim())
    searchInfo.current.source = source
    hotSearchRef.current?.show(source)
    void saveSearchSetting({ source })
    listRef.current?.loadList(searchState.searchText, source, searchInfo.current.searchType)
  }
  const handleTipSearch: HeaderBarProps['onTipSearch'] = (text) => {
    setHasDraft(!!text.trim())
    setHistoryVisible(showSuggestions && focusedRef.current && !text.trim())
    if (text.trim()) searchTipListRef.current?.search(text.trim(), layoutHeightRef.current)
    else searchTipListRef.current?.hide()
  }
  const handleHideTipList = () => {
    focusedRef.current = false
    setHistoryVisible(false)
    if (showTipTimeoutRef.current) {
      clearTimeout(showTipTimeoutRef.current)
      showTipTimeoutRef.current = null
    }
    searchTipListRef.current?.hide()
  }
  const handleSearch = (text: string, load = true) => {
    revision.current++
    setRelated(undefined)
    const keyword = text.trim()
    setHasQuery(!!keyword)
    setHasDraft(false)
    searchActions.setSearchText(keyword)
    handleHideTipList()
    headerBarRef.current?.setText(keyword)
    headerBarRef.current?.blur()
    if (keyword) void addHistoryWord(keyword)
    if (load) listRef.current?.loadList(keyword, searchInfo.current.source, searchInfo.current.searchType)
  }

  useEffect(() => {
    const consume = () => {
      const request = takeSearchRequest()
      if (!request) return
      revision.current++
      // 同步横屏页头和搜索页的分类；在通知后再设置专辑，避免被普通分类刷新清掉。
      externalTypeChange.current = true
      global.app_event.searchTypeChanged('music')
      externalTypeChange.current = false
      const source = normalizeSource('music', request.source)
      searchInfo.current.source = source
      searchInfo.current.searchType = 'music'
      setSearchType('music')
      headerBarRef.current?.setSourceList(searchMusicState.sources, source)
      handleSearch(request.keyword, !request.related)
      setRelated(request.related)
    }
    const unsubscribe = onSearchRequest(consume)
    consume()
    return unsubscribe
  // 搜索请求通过 ref 读取实时状态，只注册一次，未挂载的请求留到这里消费。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const handleShowTipList: HeaderBarProps['onShowTipList'] = (text) => {
    focusedRef.current = true
    if (showTipTimeoutRef.current) clearTimeout(showTipTimeoutRef.current)
    showTipTimeoutRef.current = setTimeout(() => {
      showTipTimeoutRef.current = null
      if (!focusedRef.current) return
      if (text.trim()) searchTipListRef.current?.search(text.trim(), layoutHeightRef.current)
      else setHistoryVisible(showSuggestions)
    }, 100)
  }

  useEffect(() => {
    if (!historyVisible) return
    const frame = requestAnimationFrame(() => {
      historyRef.current?.show()
      hotSearchRef.current?.show(searchInfo.current.source)
    })
    return () => { cancelAnimationFrame(frame) }
  }, [historyVisible, isShowHistorySearch, isShowHotSearch])

  useEffect(() => {
    if (activeId != 'nav_search') {
      handleHideTipList()
      headerBarRef.current?.blur()
    }
  }, [activeId])

  useBackHandler(useCallback(() => {
    if (commonState.navActiveId != 'nav_search' || Object.keys(commonState.componentIds).length != 1) return false
    if (historyVisible) {
      handleHideTipList()
      headerBarRef.current?.blur()
      Keyboard.dismiss()
      return true
    }
    if (!hasQuery && !hasDraft) return false
    handleSearch('')
    return true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQuery, hasDraft, historyVisible]))

  const handleBackHome = () => { handleSearch('') }

  return (
    <View style={styles.container}>
      <HeaderBar
        ref={headerBarRef}
        showBack={hasQuery || hasDraft}
        onBack={handleBackHome}
        onSourceChange={handleSourceChange}
        onTipSearch={handleTipSearch}
        onSearch={handleSearch}
        onHideTipList={handleHideTipList}
        onShowTipList={handleShowTipList}
      />
      <View style={{ ...styles.typeTabs, display: hasQuery ? 'flex' : 'none', borderBottomColor: theme['q-outline'] }}>
        <SearchTypeSelector selectedType={searchType} />
      </View>
      {related ? <View style={styles.relatedHeading}>
        <Text size={12} color={theme['q-text-secondary']} style={{ flex: 1 }}>{t('song_browse_album_hint')}</Text>
        <Button accessibilityLabel={t('song_browse_search_keyword')} style={styles.keywordSearch} onPress={() => { handleSearch(searchState.searchText) }}><Text size={12} color={theme['q-accent-text']}>{t('song_browse_search_keyword')}</Text></Button>
      </View> : null}
      <View style={styles.content} onLayout={handleLayout}>
        <TipList ref={searchTipListRef} onSearch={handleSearch} />
        <View style={{ flex: 1, display: related ? 'none' : 'flex' }}><List ref={listRef} onSearch={handleSearch} /></View>
        {related ? <RelatedList info={related} /> : null}
        {historyVisible && showSuggestions ? <View style={[styles.historyOverlay, { bottom: dockInset }]}>
          <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => { handleHideTipList(); headerBarRef.current?.blur(); Keyboard.dismiss() }} />
          <ScrollView style={[styles.suggestions, { backgroundColor: theme['c-content-background'], borderColor: theme['q-outline'] }]} contentContainerStyle={styles.suggestionContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {isShowHistorySearch ? <HistorySearch ref={historyRef} onSearch={handleSearch} /> : null}
            {isShowHotSearch ? <HotSearch ref={hotSearchRef} onSearch={handleSearch} /> : null}
          </ScrollView>
        </View> : null}
      </View>
    </View>
  )
}

const styles = createStyle({
  relatedHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 6 },
  keywordSearch: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 12 },
  container: {
    width: '100%',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  historyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 11,
  },
  suggestions: {
    flexGrow: 0,
    maxHeight: '100%',
    marginHorizontal: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
  },
  suggestionContent: {
    paddingVertical: 4,
  },
  typeTabs: {
    height: 48,
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
