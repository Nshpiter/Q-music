import { useRef, useEffect, useState, useCallback } from 'react'
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native'

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
  const [hasQuery, setHasQuery] = useState(!!searchState.searchText.trim())
  const [hasDraft, setHasDraft] = useState(false)
  const headerBarRef = useRef<HeaderBarType>(null)
  const searchTipListRef = useRef<TipListType>(null)
  const listRef = useRef<ListType>(null)
  const layoutHeightRef = useRef<number>(0)
  const searchInfo = useRef<SearchInfo>({ temp_source: 'kw', source: 'kw', searchType: 'music' })
  const showTipTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tipSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    void getSearchSetting().then(info => {
      // info.type = 'music'
      searchInfo.current.temp_source = info.temp_source
      searchInfo.current.source = normalizeSource(info.type, info.source)
      searchInfo.current.searchType = info.type
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
      setHasQuery(!!searchState.searchText.trim())
      searchInfo.current.searchType = type
      const source = normalizeSource(type, searchInfo.current.source)
      searchInfo.current.source = source
      headerBarRef.current?.setSourceList(getAvailableSources(type), source)
      void saveSearchSetting({ type, source })
      listRef.current?.loadList(searchState.searchText, source, type)
    }
    global.app_event.on('searchTypeChanged', handleTypeChange)

    return () => {
      global.app_event.off('searchTypeChanged', handleTypeChange)
      if (showTipTimeoutRef.current) clearTimeout(showTipTimeoutRef.current)
      if (tipSearchTimeoutRef.current) clearTimeout(tipSearchTimeoutRef.current)
    }
  }, [])


  const handleLayout = (e: LayoutChangeEvent) => {
    layoutHeightRef.current = e.nativeEvent.layout.height
  }

  const handleSourceChange: HeaderBarProps['onSourceChange'] = (source) => {
    setHasQuery(!!searchState.searchText.trim())
    searchInfo.current.source = source
    void saveSearchSetting({ source })
    listRef.current?.loadList(searchState.searchText, source, searchInfo.current.searchType)
  }
  const handleTipSearch: HeaderBarProps['onTipSearch'] = (text) => {
    setHasDraft(!!text.trim())
    if (tipSearchTimeoutRef.current) clearTimeout(tipSearchTimeoutRef.current)
    tipSearchTimeoutRef.current = setTimeout(() => {
      tipSearchTimeoutRef.current = null
      searchTipListRef.current?.search(text, layoutHeightRef.current)
    }, 260)
  }
  const handleHideTipList = () => {
    if (showTipTimeoutRef.current) {
      clearTimeout(showTipTimeoutRef.current)
      showTipTimeoutRef.current = null
    }
    if (tipSearchTimeoutRef.current) {
      clearTimeout(tipSearchTimeoutRef.current)
      tipSearchTimeoutRef.current = null
    }
    searchTipListRef.current?.hide()
  }
  const handleSearch: HeaderBarProps['onSearch'] = (text) => {
    const keyword = text.trim()
    setHasQuery(!!keyword)
    setHasDraft(false)
    searchActions.setSearchText(keyword)
    handleHideTipList()
    headerBarRef.current?.setText(keyword)
    headerBarRef.current?.blur()
    if (keyword) void addHistoryWord(keyword)
    listRef.current?.loadList(keyword, searchInfo.current.source, searchInfo.current.searchType)
  }
  const handleShowTipList: HeaderBarProps['onShowTipList'] = () => {
    if (showTipTimeoutRef.current) clearTimeout(showTipTimeoutRef.current)
    showTipTimeoutRef.current = setTimeout(() => {
      showTipTimeoutRef.current = null
      searchTipListRef.current?.show(layoutHeightRef.current)
    }, 100)
  }

  useBackHandler(useCallback(() => {
    if ((!hasQuery && !hasDraft) || commonState.navActiveId != 'nav_search' || Object.keys(commonState.componentIds).length != 1) return false
    handleSearch('')
    return true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQuery, hasDraft]))

  return (
    <View style={styles.container}>
      <HeaderBar
        ref={headerBarRef}
        onSourceChange={handleSourceChange}
        onTipSearch={handleTipSearch}
        onSearch={handleSearch}
        onHideTipList={handleHideTipList}
        onShowTipList={handleShowTipList}
      />
      <View style={{ ...styles.typeTabs, display: hasQuery ? 'flex' : 'none', borderBottomColor: theme['q-outline'] }}>
        <SearchTypeSelector />
      </View>
      <View style={styles.content} onLayout={handleLayout}>
        <TipList ref={searchTipListRef} onSearch={handleSearch} />
        <List ref={listRef} onSearch={handleSearch} />
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    width: '100%',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  typeTabs: {
    height: 48,
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
