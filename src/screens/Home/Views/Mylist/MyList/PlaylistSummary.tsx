import { useEffect, useState } from 'react'
import { Image, View } from 'react-native'
import { getListMusics } from '@/core/list'
import SourceLogo, { SOURCE_LOGOS } from '@/components/SourceLogo'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { getPlaylistSource } from '@/components/PlaylistIdentity'

// 只读取可见歌单的本地内容；列表更新后重取，不发起平台网络请求。
export default ({ list }: { list: LX.List.MyListInfo }) => {
  const theme = useTheme()
  const t = useI18n()
  const source = getPlaylistSource(list)
  const [summary, setSummary] = useState<{ count: number, cover?: string }>({ count: 0 })
  const [failedCover, setFailedCover] = useState('')
  useEffect(() => {
    let generation = 0
    let active = true
    const refresh = () => {
      const current = ++generation
      void getListMusics(list.id).then(musics => {
        if (active && current == generation) setSummary({ count: musics.length, cover: musics.find(song => song.meta.picUrl)?.meta.picUrl ?? undefined })
      }).catch(() => {})
    }
    const update = (ids: string[]) => { if (ids.includes(list.id)) refresh() }
    refresh()
    global.app_event.on('myListMusicUpdate', update)
    return () => { active = false; global.app_event.off('myListMusicUpdate', update) }
  }, [list.id])
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
    <View style={{ width: 54, height: 54, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: theme['q-surface-tint'] }}>
      {summary.cover && summary.cover != failedCover
        ? <Image source={{ uri: summary.cover }} onError={() => { setFailedCover(summary.cover ?? '') }} fadeDuration={0} style={{ width: 54, height: 54 }} />
        : <Icon name={list.id == 'love' ? 'love' : 'album'} size={25} color={theme['q-accent-text']} />}
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
      <Text size={15} numberOfLines={1} style={{ fontWeight: '600' }}>{list.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {source ? <SourceLogo source={source} size={14} /> : null}
        <Text size={11} numberOfLines={1} color={theme['q-text-secondary']} style={{ flexShrink: 1 }}>{t('library_track_count', { count: summary.count })} · {source ? SOURCE_LOGOS[source]?.label ?? source : t('playlist_local')}</Text>
      </View>
    </View>
  </View>
}
