import { useEffect, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'

const SOURCES: Record<string, { label: string, mark: string, color: string, uri: string }> = {
  tx: { label: 'QQ音乐', mark: 'Q', color: '#20b97a', uri: 'https://y.qq.com/mediastyle/yqq/img/logo.png?max_age=2592000' },
  wy: { label: '网易云音乐', mark: '云', color: '#e6172d', uri: 'https://s2.music.126.net/style/web2/img/logo.png?564bc3a5ff72eb9d555a7f46bf934203' },
  kg: { label: '酷狗音乐', mark: 'K', color: '#2489e8', uri: 'https://www.kugou.com/common/images/icon_logo_v20.png' },
  kw: { label: '酷我音乐', mark: '酷', color: '#ff9d19', uri: 'https://h5s.kuwo.cn/www/kw-www/img/logo.ce08bf7.png' },
  mg: { label: '咪咕音乐', mark: '咪', color: '#ee2d7b', uri: 'https://h5.nf.migu.cn/app/favicon.ico' },
  spotify: { label: 'Spotify', mark: 'S', color: '#1db954', uri: 'https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png' },
}

export default ({ source, size = 24 }: { source: string, size?: number }) => {
  const theme = useTheme()
  const item = SOURCES[source]
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    setLoadFailed(false)
  }, [source])

  if (!item) return null
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={item.label}
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: loadFailed ? item.color : theme['q-surface-base'],
        },
      ]}
    >
      {loadFailed
        ? <Text size={Math.max(10, size * 0.48)} color="#ffffff" style={styles.fallbackText}>{item.mark}</Text>
        : <Image source={{ uri: item.uri }} style={{ width: size, height: size }} resizeMode="contain" onError={() => { setLoadFailed(true) }} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontWeight: '800',
    textAlign: 'center',
  },
})
