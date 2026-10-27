import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import OnlineList, { type OnlineListType } from '@/components/OnlineList'
import { createSongBrowseTask, SongBrowseError } from '@/core/music/songBrowse'
import type { SearchNavigationRequest } from '@/core/search/navigation'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'

// 专辑复用搜索页的标准歌曲行、菜单、多选及下载，不在播放器弹窗里再维护一份列表。
export default ({ info }: { info: NonNullable<SearchNavigationRequest['related']> }) => {
  const t = useI18n()
  const theme = useTheme()
  const [error, setError] = useState('')
  const list = useRef<OnlineListType>(null)
  const rows = useRef<LX.Music.MusicInfoOnline[]>([])
  const page = useRef(0)
  const hasMore = useRef(true)
  const task = useRef<ReturnType<typeof createSongBrowseTask> | null>(null)
  const load = useCallback((reset = false) => {
    if (!reset && (task.current != null || !hasMore.current)) return
    task.current?.cancel()
    setError('')
    if (reset) {
      rows.current = []; page.current = 0; hasMore.current = true
      list.current?.setList([], false, true)
    }
    list.current?.setStatus('loading')
    const next = createSongBrowseTask(info.song, info.kind, '', page.current + 1)
    task.current = next
    void next.promise.then(result => {
      if (task.current != next) return
      const seen = new Set(rows.current.map(song => song.id))
      const additions = result.songs.filter(song => { if (seen.has(song.id)) return false; seen.add(song.id); return true })
      if (result.songs.length && !additions.length) throw new Error('Repeated browse page')
      rows.current = [...rows.current, ...additions]
      page.current++
      hasMore.current = result.hasMore && additions.length > 0
      list.current?.setList(rows.current, !reset, true)
      list.current?.setStatus(hasMore.current ? 'idle' : 'end')
    }).catch((reason: unknown) => {
      if (task.current != next) return
      setError(t(reason instanceof SongBrowseError && (reason.reason == 'unavailable' || reason.reason == 'timeout') ? `song_browse_${reason.reason}` : 'load_failed'))
      list.current?.setStatus('error')
    }).finally(() => { if (task.current == next) task.current = null })
  }, [info, t])
  useEffect(() => {
    load(true)
    return () => { task.current?.cancel(); task.current = null }
  }, [load])
  return <View style={{ flex: 1 }}>
    {error ? <Text size={13} color={theme['q-text-secondary']} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>{error}</Text> : null}
    <OnlineList ref={list} onRefresh={() => { load(true) }} onLoadMore={() => { load() }} />
  </View>
}
