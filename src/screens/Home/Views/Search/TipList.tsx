import { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react'
import SearchTipList, { type SearchTipListProps as _SearchTipListProps, type SearchTipListType as _SearchTipListType } from '@/components/SearchTipList'
import Button from '@/components/common/Button'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import musicSdk from '@/utils/musicSdk'
import searchState from '@/store/search/state'
import { setSearchText, setTipList, setTipListInfo } from '@/core/search/search'
import { debounce } from '@/utils'
import { Q_UI } from '@/theme/ui'

export const ITEM_HEIGHT = Math.max(Q_UI.touchSize, Math.round(scaleSizeH(44)))

export const debounceTipSearch = debounce((keyword: string, source: LX.OnlineSource, callback: (list: string[]) => void) => {
  const api = musicSdk[source]?.tipSearch
  if (!api) { callback([]); return }
  void Promise.resolve().then(() => api.search(keyword)).then(callback).catch(() => { callback([]) })
}, 200)


export type SearchTipListProps = _SearchTipListProps<string>
export type SearchTipListType = _SearchTipListType<string>

interface TipListProps {
  source: LX.OnlineSource | 'all'
  onSearch: (keyword: string) => void
}
export interface TipListType {
  search: (keyword: string, height: number) => void
  show: (height: number) => void
  hide: () => void
}

export default forwardRef<TipListType, TipListProps>(({ onSearch, source: selectedSource }, ref) => {
  const searchTipListRef = useRef<SearchTipListType>(null)
  const [visible, setVisible] = useState(false)
  const visibleListRef = useRef(false)
  const isUnmountedRef = useRef(false)
  const searchRequestRef = useRef(0)
  const source = selectedSource == 'all' ? searchState.temp_source : selectedSource
  const sourceRef = useRef(source)
  sourceRef.current = source
  const lastQuery = useRef({ keyword: '', height: 0 })

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  const handleSearch = (keyword: string, height: number, requestId: number) => {
    if (searchRequestRef.current != requestId || !visibleListRef.current || isUnmountedRef.current) return
    searchTipListRef.current?.setHeight(height)
    setSearchText(keyword)
    if (keyword) {
      const source = sourceRef.current
      setTipListInfo(keyword, source)
      debounceTipSearch(keyword, source, (list) => {
        if (!visibleListRef.current || isUnmountedRef.current || searchRequestRef.current != requestId) return
        if (keyword != searchState.tipListInfo.text || source != searchState.tipListInfo.source || source != sourceRef.current) return
        setTipList(list)
        searchTipListRef.current?.setList(list)
      })
    } else {
      setTipListInfo(keyword, sourceRef.current)
      setTipList([])
      searchTipListRef.current?.setList([])
    }
  }

  const handleShowList = (height: number) => {
    searchTipListRef.current?.setHeight(height)
    if (searchState.tipListInfo.source == sourceRef.current && searchState.tipListInfo.list.length) {
      visibleListRef.current = true
      searchTipListRef.current?.setList([...searchState.tipListInfo.list])
    }
  }

  const handleHide = () => {
    searchRequestRef.current++
    visibleListRef.current = false
    searchTipListRef.current?.setList([])
  }

  useEffect(() => {
    const requestId = ++searchRequestRef.current
    setTipList([])
    searchTipListRef.current?.setList([])
    if (visibleListRef.current) handleSearch(lastQuery.current.keyword, lastQuery.current.height, requestId)
  // 切换平台重新联想；回调通过 ref 拒绝旧平台的迟到响应。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  useImperativeHandle(ref, () => ({
    search(keyword, height) {
      lastQuery.current = { keyword, height }
      const requestId = ++searchRequestRef.current
      visibleListRef.current = true
      if (visible) handleSearch(keyword, height, requestId)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleSearch(keyword, height, requestId)
        })
      }
    },
    show(height) {
      const requestId = ++searchRequestRef.current
      visibleListRef.current = true
      if (visible) handleShowList(height)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          if (searchRequestRef.current != requestId || !visibleListRef.current || isUnmountedRef.current) return
          handleShowList(height)
        })
      }
    },
    hide() {
      handleHide()
    },
  }), [visible])

  const renderItem: SearchTipListProps['renderItem'] = ({ item, index }) => {
    return (
      <Button
        style={styles.item}
        accessibilityLabel={item}
        onPress={() => { onSearch(item) }}
        key={index}
      >
        <Text numberOfLines={1}>{item}</Text>
      </Button>
    )
  }
  const getkey: SearchTipListProps['keyExtractor'] = (item, index) => String(index)
  const getItemLayout: SearchTipListProps['getItemLayout'] = (data, index) => {
    return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  }

  return (
    visible
      ? <SearchTipList
          ref={searchTipListRef}
          renderItem={renderItem}
          onPressBg={handleHide}
          keyExtractor={getkey}
          getItemLayout={getItemLayout}
        />
      : null
  )
})


const styles = createStyle({
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    paddingRight: 15,
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
})

