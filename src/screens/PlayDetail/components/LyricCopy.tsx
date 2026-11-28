import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Keyboard, ScrollView, View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { type Line } from '@/plugins/lyric'
import { usePlayerMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Popup, { type PopupType } from '@/components/common/Popup'
import { toast } from '@/utils/tools'
import { formatPlayTime2 } from '@/utils'
import { findLyricLines, lyricCopyText } from './lyricCopyText'

export const copyLyricLine = (line: Parameters<typeof lyricCopyText>[0][number]) => {
  const text = lyricCopyText([line])
  if (!text) return
  Clipboard.setString(text)
  toast(global.i18n.t('copy_name_tip'))
}

// 复制面板保留打开时的歌词快照，播放滚动和翻译补全不会打断系统文字选择。
export default ({ lines, onSeek }: { lines: Line[], onSeek: (seconds: number) => void }) => {
  const t = useI18n()
  const theme = useTheme()
  const music = usePlayerMusicInfo()
  const popup = useRef<PopupType>(null)
  const [snapshot, setSnapshot] = useState<{ id: string | null, title: string, lines: Line[], text: string } | null>(null)
  const [query, setQuery] = useState('')
  const searching = !!query.trim()
  const matches = useMemo(() => snapshot ? findLyricLines(snapshot.lines, query) : [], [snapshot, query])
  useEffect(() => {
    if (snapshot) popup.current?.setVisible(true)
  }, [snapshot])
  useEffect(() => { popup.current?.setVisible(false) }, [music.id])
  const available = useMemo(() => lines.some(line => line.text.trim() || line.extendedLyrics.some(text => text.trim())), [lines])
  const jumpTo = (line: Line) => {
    if (!snapshot?.id || snapshot.id !== playerState.musicInfo.id || !Number.isFinite(line.time)) return
    Keyboard.dismiss()
    popup.current?.setVisible(false)
    onSeek(Math.max(0, line.time) / 1000)
  }
  return <>
    <Button
      accessibilityLabel={t('play_detail_page_lyric')}
      accessibilityRole="button"
      disabled={!available}
      onPress={() => {
        setQuery('')
        setSnapshot({ id: music.id, title: music.name, lines, text: lyricCopyText(lines) })
      }}
      style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 10, marginLeft: 4, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: available ? 1 : 0.35 }}
    >
      <Icon name="lyric-on" rawSize={18} color={theme['q-text-secondary']} />
      <Text size={11} color={theme['q-text-secondary']} style={{ marginLeft: 5 }}>{t('play_detail_page_lyric')}</Text>
    </Button>
    {snapshot && <Popup ref={popup} title={snapshot.title || t('play_detail_page_lyric')} onHide={() => { setSnapshot(null) }}>
      <Input value={query} onChangeText={setQuery} returnKeyType="search"
        placeholder={t('lyric_search_placeholder')} accessibilityLabel={t('lyric_search_placeholder')}
        clearBtn clearButtonAccessibilityLabel={t('lyric_search_clear')}
        containerStyle={{ flexGrow: 0, flexShrink: 0, marginHorizontal: 16, marginTop: 8, marginBottom: 4 }} />
      {searching ? <FlatList
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 14, gap: 6 }}
        keyboardShouldPersistTaps="handled"
        data={matches}
        keyExtractor={(line, index) => `${line.time}:${index}`}
        ListEmptyComponent={<View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
          <Icon name="search-2" rawSize={24} color={theme['q-text-secondary']} />
          <Text size={13} color={theme['q-text-secondary']}>{t('lyric_search_empty')}</Text>
        </View>}
        renderItem={({ item }) => <Button accessibilityRole="button" accessibilityHint={t('lyric_search_jump')} onPress={() => { jumpTo(item) }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, minHeight: 50, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: theme['q-surface-raised'], borderWidth: 0.5, borderColor: theme['q-outline'] }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: theme['q-surface-tint'] }}>
            <Text size={11} color={theme['q-accent-text']} style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatPlayTime2(Math.max(0, item.time) / 1000)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            {item.text ? <Text size={14} style={{ fontWeight: '500' }}>{item.text}</Text> : null}
            {item.extendedLyrics.filter(Boolean).map((text, index) => <Text key={index} size={12} color={theme['q-text-secondary']}>{text}</Text>)}
          </View>
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme['q-surface-tint'] }}>
            <Icon accessible={false} name="play" rawSize={13} color={theme['q-accent-text']} />
          </View>
        </Button>}
      /> : <>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text size={12} color={theme['q-text-secondary']} style={{ marginBottom: 8 }}>{t('lyric_copy_hint')}</Text>
          <Text selectable size={16} style={{ lineHeight: 28 }}>{snapshot.text}</Text>
        </ScrollView>
        <Button disabled={!snapshot.text} onPress={() => { Clipboard.setString(snapshot.text); toast(t('copy_name_tip')) }} style={{ minHeight: 46, margin: 16, borderRadius: 14, borderWidth: 0.5, borderColor: theme['q-outline'], flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: theme['q-surface-tint'] }}>
          <Icon accessible={false} name="copy" rawSize={16} color={theme['q-accent-text']} />
          <Text style={{ fontWeight: '700' }} color={theme['q-accent-text']}>{t('lyric_copy_all')}</Text>
        </Button>
      </>}
    </Popup>}
  </>
}
