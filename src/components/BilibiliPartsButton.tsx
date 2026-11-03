import { useEffect, useRef, useState } from 'react'
import { FlatList, Modal, SafeAreaView, View } from 'react-native'
import Button from './common/Button'
import Text from './common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { bilibiliClient } from '@/utils/musicSdk/bi'
import { toNewMusicInfo } from '@/utils'
import { playFromPage } from '@/core/player/selection'

type Contents = Awaited<ReturnType<typeof bilibiliClient.videoContents>>
type Track = Contents['parts'][number]
type Mode = 'parts' | 'collection'
const LIMIT = 30

export default ({ music }: { music: LX.Music.MusicInfoOnline }) => {
  const theme = useTheme()
  const t = useI18n()
  const [shown, setShown] = useState(false)
  const [contents, setContents] = useState<Contents>()
  const [list, setList] = useState<Track[]>([])
  const [mode, setMode] = useState<Mode>('parts')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const controller = useRef<AbortController>()
  const listRef = useRef<FlatList<Track>>(null)
  const close = () => { controller.current?.abort(); setShown(false) }
  useEffect(() => {
    setShown(false)
    return () => { controller.current?.abort() }
  }, [music.id])
  const load = async(data: Contents, nextMode: Mode, nextPage: number) => {
    controller.current?.abort()
    const current = controller.current = new AbortController()
    setMode(nextMode); setPage(nextPage); setLoading(true); setError(false); setList([])
    try {
      if (nextMode == 'parts') {
        setTotal(data.parts.length)
        setList(data.parts.slice((nextPage - 1) * LIMIT, nextPage * LIMIT))
      } else if (data.collection) {
        const result = await bilibiliClient.collection(data.collection.url, nextPage, LIMIT, current.signal)
        if (current.signal.aborted) return
        if (result.incomplete) throw new Error('incomplete')
        setTotal(result.total); setList(result.list)
      }
      listRef.current?.scrollToOffset({ offset: 0, animated: false })
    } catch { if (!current.signal.aborted) setError(true) } finally { if (!current.signal.aborted) setLoading(false) }
  }
  const open = async() => {
    controller.current?.abort()
    const current = controller.current = new AbortController()
    setShown(true); setLoading(true); setError(false); setContents(undefined); setList([]); setTotal(0); setMode('parts'); setPage(1)
    try {
      const data = await bilibiliClient.videoContents(String(music.meta.songId), current.signal)
      if (current.signal.aborted) return
      setContents(data)
      await load(data, data.parts.length == 1 && data.collection ? 'collection' : 'parts', 1)
    } catch { if (!current.signal.aborted) { setError(true); setLoading(false) } }
  }
  const play = async(index: number) => {
    if (!contents) return
    const tracks = mode == 'parts' ? contents.parts : list
    const selected = mode == 'parts' ? (page - 1) * LIMIT + index : index
    try {
      await playFromPage(`bilibili:${music.id}:${mode}:${page}`, tracks.map(item => toNewMusicInfo(item) as LX.Music.MusicInfoOnline), selected)
      close()
    } catch { setError(true) }
  }
  const actionStyle = { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' as const, backgroundColor: theme['q-surface-tint'] }
  return <>
    <Button accessibilityLabel={`${music.name} · ${t('bili_parts')}`} onPress={() => { void open() }} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 10 }}>
      <Text size={12} color={theme['q-accent-text']}>{t('bili_parts')}</Text>
    </Button>
    {shown ? <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme['c-content-background'] }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 840, alignSelf: 'center', padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text size={20} style={{ flex: 1, fontWeight: '600' }}>{t('bili_parts')}</Text>
            <Button style={actionStyle} onPress={close}><Text size={14}>{t('close')}</Text></Button>
          </View>
          <Text numberOfLines={2} size={15}>{contents?.title ?? music.name}</Text>
          {contents ? <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button accessibilityRole="tab" accessibilityState={{ selected: mode == 'parts' }} onPress={() => { void load(contents, 'parts', 1) }} style={[actionStyle, { backgroundColor: mode == 'parts' ? theme['q-surface-tint'] : 'transparent' }]}><Text color={mode == 'parts' ? theme['q-accent-text'] : theme['q-text-secondary']}>{t('bili_video_parts')} · {contents.parts.length}</Text></Button>
            {contents.collection ? <Button accessibilityRole="tab" accessibilityState={{ selected: mode == 'collection' }} onPress={() => { void load(contents, 'collection', 1) }} style={[actionStyle, { backgroundColor: mode == 'collection' ? theme['q-surface-tint'] : 'transparent' }]}><Text color={mode == 'collection' ? theme['q-accent-text'] : theme['q-text-secondary']}>{t('bili_collection')}</Text></Button> : null}
          </View> : null}
          {mode == 'collection' ? <Text size={12} color={theme['q-text-secondary']}>{contents?.collection?.name}</Text> : contents?.parts.length == 1 ? <Text size={12} color={theme['q-text-secondary']}>{t('bili_single_part')}</Text> : null}
          <Text size={12} color={theme['q-text-secondary']}>{t('bili_play_hint')}</Text>
          {loading || error ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <Text accessibilityLiveRegion="polite">{t(loading ? 'bili_loading' : 'bili_load_failed')}</Text>
            {error ? <Button style={actionStyle} onPress={() => { void (contents ? load(contents, mode, page) : open()) }}><Text>{t('bili_retry')}</Text></Button> : null}
          </View> : <FlatList ref={listRef} style={{ flex: 1 }} data={list} keyExtractor={item => item.songmid} renderItem={({ item, index }) => <Button accessibilityLabel={`${t('bili_play')} ${item.name}`} onPress={() => { void play(index) }} style={{ flexDirection: 'row', minHeight: 58, alignItems: 'center', gap: 10, padding: 10, borderRadius: 12 }}>
            <Text size={12} color={theme['q-text-secondary']} style={{ width: 24 }}>{(page - 1) * LIMIT + index + 1}</Text>
            <Text numberOfLines={3} size={14} style={{ flex: 1, lineHeight: 21 }}>{item.name}</Text>
            <Text size={12} color={theme['q-text-secondary']}>{item.interval}</Text><Text color={theme['q-accent-text']}>▷</Text>
          </Button>} />}
          {total > LIMIT ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <Button style={[actionStyle, { opacity: loading || page <= 1 ? 0.4 : 1 }]} disabled={loading || page <= 1} onPress={() => { if (contents) void load(contents, mode, page - 1) }}><Text size={13}>{t('bili_prev')}</Text></Button>
            <Text size={13}>{page} / {Math.ceil(total / LIMIT)}</Text>
            <Button style={[actionStyle, { opacity: loading || page * LIMIT >= total ? 0.4 : 1 }]} disabled={loading || page * LIMIT >= total} onPress={() => { if (contents) void load(contents, mode, page + 1) }}><Text size={13}>{t('bili_next')}</Text></Button>
          </View> : null}
        </View>
      </SafeAreaView>
    </Modal> : null}
  </>
}
