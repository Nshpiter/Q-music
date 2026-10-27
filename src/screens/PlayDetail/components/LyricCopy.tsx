import { useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useLrcSet } from '@/plugins/lyric'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Popup, { type PopupType } from '@/components/common/Popup'
import { toast } from '@/utils/tools'
import { lyricCopyText } from './lyricCopyText'

// 复制面板保留打开时的歌词快照，播放滚动和翻译补全不会打断系统文字选择。
export default () => {
  const t = useI18n()
  const theme = useTheme()
  const lines = useLrcSet()
  const music = usePlayerMusicInfo()
  const popup = useRef<PopupType>(null)
  const [snapshot, setSnapshot] = useState<{ title: string, text: string } | null>(null)
  useEffect(() => {
    if (snapshot) popup.current?.setVisible(true)
  }, [snapshot])
  useEffect(() => { popup.current?.setVisible(false) }, [music.id])
  const available = lines.some(line => line.text.trim())
  return <>
    <Button
      accessibilityLabel={t('play_detail_page_lyric')}
      accessibilityRole="button"
      disabled={!available}
      onPress={() => { setSnapshot({ title: music.name, text: lyricCopyText(lines) }) }}
      style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 10, marginLeft: 4, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: available ? 1 : 0.35 }}
    >
      <Icon name="lyric-on" rawSize={18} color={theme['q-text-secondary']} />
      <Text size={11} color={theme['q-text-secondary']} style={{ marginLeft: 5 }}>{t('play_detail_page_lyric')}</Text>
    </Button>
    {snapshot && <Popup ref={popup} title={t('lyric_copy_title')} onHide={() => { setSnapshot(null) }}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
        <Text size={15} numberOfLines={1} style={{ fontWeight: '600' }}>{snapshot.title}</Text>
        <Text size={12} color={theme['q-text-secondary']} style={{ marginTop: 6 }}>{t('lyric_copy_hint')}</Text>
      </View>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12 }}>
        <Text selectable size={16} style={{ lineHeight: 28 }}>{snapshot.text}</Text>
      </ScrollView>
      <Button disabled={!snapshot.text} onPress={() => { Clipboard.setString(snapshot.text); toast(t('copy_name_tip')) }} style={{ minHeight: 48, margin: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme['q-surface-tint'] }}>
        <Text color={theme['q-accent-text']}>{t('lyric_copy_all')}</Text>
      </Button>
    </Popup>}
  </>
}
