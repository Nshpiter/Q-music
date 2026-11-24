import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { InitState as SearchState } from '@/store/search/state'
import type { Source as MusicSource } from '@/store/search/music/state'
import type { Source as SongListSource } from '@/store/search/songlist/state'
import MusicList, { type MusicListType } from './MusicList'
import BlankView, { type BlankViewType } from './BlankView'
import SonglistList from './SonglistList'
import AlbumList from './AlbumList'
import type { Album } from '@/core/search/albums'

interface ListProps {
  onSearch: (keyword: string) => void
  onOpenAlbum: (album: Album) => void
}
export interface ListType {
  loadList: (text: string, source: MusicSource | SongListSource, type: SearchState['searchType']) => void
}

export default forwardRef<ListType, ListProps>(({ onSearch, onOpenAlbum }, ref) => {
  const [query, setQuery] = useState<{ text: string, source: MusicSource, type: SearchState['searchType'] }>()
  const listRef = useRef<MusicListType>(null)
  const blankViewRef = useRef<BlankViewType>(null)

  useImperativeHandle(ref, () => ({
    loadList(text, source, type) {
      setQuery({ text, source, type })
    },
  }), [])

  useEffect(() => {
    if (!query) return
    if (!query.text) blankViewRef.current?.show(query.source)
    else if (query.type != 'album') listRef.current?.loadList(query.text, query.source)
  }, [query])

  if (!query?.text) return <BlankView ref={blankViewRef} onSearch={onSearch} />
  if (query.type == 'album') return <AlbumList key={JSON.stringify([query.source, query.text])} text={query.text} source={query.source} onOpen={onOpenAlbum} />
  if (query.type == 'songlist') return <SonglistList ref={listRef} />
  return <MusicList ref={listRef} />
})
