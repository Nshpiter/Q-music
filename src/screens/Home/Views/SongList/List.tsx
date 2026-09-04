import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Songlist, { type SonglistProps, type SonglistType } from './components/Songlist'
import { clearList, getList, setList, setListInfo } from '@/core/songlist'
import songlistState from '@/store/songlist/state'
import { type Source } from '@/store/songlist/state'


export interface ListType {
  loadList: (source: Source, sortId: string, tagId: string) => void
}

export default forwardRef<ListType, {}>((props, ref) => {
  const listRef = useRef<SonglistType>(null)
  const isUnmountedRef = useRef(false)
  const requestIdRef = useRef(0)
  useImperativeHandle(ref, () => ({
    async loadList(source, sortId, tagId) {
      const requestId = ++requestIdRef.current
      const listInfo = songlistState.listInfo
      listRef.current?.setList([])
      if (listInfo.tagId == tagId && listInfo.sortId == sortId && listInfo.source == source && listInfo.list.length) {
        requestAnimationFrame(() => {
          if (isUnmountedRef.current || requestId != requestIdRef.current) return
          listRef.current?.setList(listInfo.list)
          listRef.current?.setStatus(listInfo.maxPage <= listInfo.page ? 'end' : 'idle')
        })
      } else {
        listRef.current?.setStatus('loading')
        setListInfo(source, tagId, sortId)
        const page = 1
        return getList(source, tagId, sortId, page).then((info) => {
          if (isUnmountedRef.current || requestId != requestIdRef.current) return
          const result = setList(info, tagId, sortId, page)
          requestAnimationFrame(() => {
            if (isUnmountedRef.current || requestId != requestIdRef.current) return
            listRef.current?.setList(result.list)
            listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
          })
        }).catch(() => {
          if (isUnmountedRef.current || requestId != requestIdRef.current) return
          if (songlistState.listInfo.list.length && page == 1) clearList()
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


  const handleRefresh: SonglistProps['onRefresh'] = () => {
    const requestId = ++requestIdRef.current
    const page = 1
    const { source, tagId, sortId } = songlistState.listInfo
    listRef.current?.setStatus('refreshing')
    getList(source, tagId, sortId, page, true).then((info) => {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      const result = setList(info, tagId, sortId, page)
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      if (songlistState.listInfo.list.length && page == 1) clearList()
      listRef.current?.setStatus('error')
    })
  }
  const handleLoadMore: SonglistProps['onLoadMore'] = () => {
    const requestId = ++requestIdRef.current
    listRef.current?.setStatus('loading')
    const { source, tagId, sortId, list, page: currentPage } = songlistState.listInfo
    const page = list.length ? currentPage + 1 : 1
    getList(source, tagId, sortId, page).then((info) => {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      const result = setList(info, tagId, sortId, page)
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      if (songlistState.listInfo.list.length && page == 1) clearList()
      listRef.current?.setStatus('error')
    })
  }

  return <Songlist
    ref={listRef}
    onRefresh={handleRefresh}
    onLoadMore={handleLoadMore}
   />
})

