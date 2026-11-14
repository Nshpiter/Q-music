import { useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { FlatList, type FlatListProps, RefreshControl } from 'react-native'

// import { useMusicList } from '@/store/list/hook'
import CommentFloor from './CommentFloor'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { type Comment } from '../utils'
import Footer, { type FooterLabel } from '@/components/common/ListFooter'
import ContentState from '@/components/common/ContentState'

type FlatListType = FlatListProps<Comment>

export interface ListProps {
  onRefresh: () => void
  onLoadMore: () => void
}
export interface ListType {
  setList: (list: Comment[]) => void
  getList: () => Comment[]
  setStatus: (val: Status) => void
}
export type Status = 'loading' | 'refreshing' | 'end' | 'error' | 'idle'

const List = forwardRef<ListType, ListProps>(({
  onRefresh,
  onLoadMore,
}, ref) => {
  // const t = useI18n()
  const theme = useTheme()
  const flatListRef = useRef<FlatList>(null)
  const [currentList, setList] = useState<Comment[]>([])
  const [status, setStatus] = useState<Status>('idle')
  // const currentListIdRef = useRef('')
  // console.log('render comment list')

  useImperativeHandle(ref, () => ({
    setList(list) {
      setList(list)
    },
    getList() {
      return currentList
    },
    setStatus(val) {
      setStatus(val)
    },
  }))

  const handleLoadMore = () => {
    if (status != 'idle') return
    onLoadMore()
  }

  const renderItem: FlatListType['renderItem'] = ({ item }) => <CommentFloor comment={item} />

  const getkey: FlatListType['keyExtractor'] = item => item.id

  const refreshControl = useMemo(() => (
    <RefreshControl
      colors={[theme['c-primary']]}
      // progressBackgroundColor={theme.primary}
      refreshing={status == 'refreshing'}
      onRefresh={onRefresh} />
  ), [status, onRefresh, theme])
  const footerComponent = useMemo(() => {
    if (!currentList.length) return null
    let label: FooterLabel
    switch (status) {
      case 'refreshing': return null
      case 'loading':
        label = 'list_loading'
        break
      case 'end':
        label = 'list_end'
        break
      case 'error':
        label = 'list_error'
        break
      case 'idle':
        label = null
        break
    }
    return <Footer label={label} onLoadMore={onLoadMore} />
  }, [currentList.length, onLoadMore, status])

  const emptyComponent = useMemo(() => {
    switch (status) {
      case 'loading':
      case 'refreshing':
        return <ContentState status="loading" />
      case 'error':
        return <ContentState status="error" onRetry={onLoadMore} />
      case 'end':
        return <ContentState status="empty" />
      default:
        return null
    }
  }, [onLoadMore, status])

  return (
    <FlatList
      ref={flatListRef}
      style={styles.list}
      data={currentList}
      onEndReachedThreshold={0.5}
      // maxToRenderPerBatch={4}
      // updateCellsBatchingPeriod={80}
      // windowSize={8}
      removeClippedSubviews={false}
      // initialNumToRender={12}
      renderItem={renderItem}
      keyExtractor={getkey}
      // onRefresh={onRefresh}
      // refreshing={refreshing}
      onEndReached={handleLoadMore}
      refreshControl={refreshControl}
      ListFooterComponent={footerComponent}
      ListEmptyComponent={emptyComponent}
    />
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 15,
    paddingRight: 15,
  },

})

export default List
