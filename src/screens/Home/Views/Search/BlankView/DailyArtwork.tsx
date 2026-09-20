import { memo, useEffect, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { getPicUrl } from '@/core/music/online'
import { useTheme } from '@/store/theme/hook'

// 拼图和横向推荐共享请求，避免同一封面重复访问音源。
const covers = new Map<string, Promise<string>>()
const loadCover = async(musicInfo: LX.Music.MusicInfoOnline) => {
  const key = `${musicInfo.source}_${musicInfo.id}`
  let request = covers.get(key)
  if (!request) {
    request = getPicUrl({ musicInfo, isRefresh: false, allowToggleSource: false }).catch(() => '')
    if (covers.size >= 64) covers.delete(covers.keys().next().value!)
    covers.set(key, request)
  }
  return request
}

export default memo(({ item }: { item?: LX.Music.MusicInfoOnline }) => {
  const theme = useTheme()
  const [url, setUrl] = useState(item?.meta.picUrl ?? '')
  useEffect(() => {
    let active = true
    setUrl(item?.meta.picUrl ?? '')
    if (item && !item.meta.picUrl) {
      void loadCover(item).then(url => { if (active) setUrl(url) })
    }
    return () => { active = false }
  }, [item])
  return (
    <View style={{ ...styles.cover, backgroundColor: theme['q-surface-tint'] }}>
      <Icon accessible={false} name="album" color={theme['q-accent-text']} rawSize={26} />
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} onError={() => { setUrl('') }} /> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  cover: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
})
