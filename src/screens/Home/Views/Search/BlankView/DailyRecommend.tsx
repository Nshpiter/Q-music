import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { getDailyRecommend } from '@/core/dailyRecommend'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { qSurfaceShadow } from '@/theme/ui'
import { createStyle } from '@/utils/tools'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, Image, TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'

type Source = LX.OnlineSource | 'all'

export interface DailyRecommendType {
  show: (source: Source) => void
}

export default forwardRef<DailyRecommendType>((_, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const sourceRef = useRef<Source>('kw')
  const requestIdRef = useRef(0)
  const isUnmountedRef = useRef(false)
  const [list, setList] = useState<LX.Music.MusicInfoOnline[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => () => {
    isUnmountedRef.current = true
  }, [])

  const load = useCallback(async(source: Source, force = false) => {
    sourceRef.current = source
    const requestId = ++requestIdRef.current
    setLoading(true)
    setLoadError(false)
    try {
      const nextList = await getDailyRecommend(source, force)
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      setList(nextList)
    } catch {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      setList([])
      setLoadError(true)
    } finally {
      if (!isUnmountedRef.current && requestId == requestIdRef.current) setLoading(false)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show(source) {
      void load(source)
    },
  }), [load])

  const handlePlay = useCallback(async(index = 0) => {
    if (!list.length) return
    const date = new Date()
    await setTempList(`q_daily_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`, list)
    await playList(LIST_IDS.TEMP, index)
  }, [list])

  return (
    <View
      style={{
        ...styles.container,
        ...qSurfaceShadow,
        backgroundColor: theme['q-surface-raised'],
        borderColor: theme['q-outline'],
      }}
    >
      <View style={styles.header}>
        <View style={styles.titleContent}>
          <Text size={19} style={styles.title} color={theme['q-text-primary']}>{t('search_daily_recommend')}</Text>
          <Text size={12} style={styles.subtitle} color={theme['q-text-secondary']}>{t('search_daily_recommend_subtitle')}</Text>
        </View>
        <View style={styles.actions}>
          <Button disabled={loading} style={{ ...styles.action, backgroundColor: theme['q-surface-tint'] }} onPress={() => { void load(sourceRef.current, true) }}>
            <Text size={12} color={theme['q-accent-text']}>{t('search_daily_recommend_refresh')}</Text>
          </Button>
          <Button disabled={loading || !list.length} style={{ ...styles.action, backgroundColor: theme['q-accent'] }} onPress={() => { void handlePlay() }}>
            <Text size={12} color={theme['q-on-accent']}>{t('search_daily_recommend_play')}</Text>
          </Button>
        </View>
      </View>
      {loading
        ? <View style={styles.state}><ActivityIndicator color={theme['q-accent']} /><Text size={12} color={theme['q-text-secondary']}>{t('search_daily_recommend_loading')}</Text></View>
        : loadError
          ? (
              <View style={styles.state}>
                <Text size={12} color={theme['q-text-secondary']}>{t('load_failed')}</Text>
                <Button style={{ ...styles.errorAction, backgroundColor: theme['q-surface-tint'] }} onPress={() => { void load(sourceRef.current, true) }}>
                  <Icon name="available_updates" color={theme['q-accent-text']} rawSize={14} />
                  <Text size={12} color={theme['q-accent-text']}>{t('list_retry')}</Text>
                </Button>
              </View>
            )
          : list.length
            ? list.slice(0, 8).map((item, index) => (
                <TouchableOpacity key={item.id} style={styles.item} activeOpacity={0.65} onPress={() => { void handlePlay(index) }}>
                  <View style={{ ...styles.cover, backgroundColor: theme['q-surface-tint'] }}>
                    {item.meta.picUrl
                      ? <Image source={{ uri: item.meta.picUrl }} style={styles.coverImage} />
                      : <Icon name="album" color={theme['q-accent-text']} rawSize={18} />}
                  </View>
                  <View style={styles.musicInfo}>
                    <Text numberOfLines={1} size={14} color={theme['q-text-primary']}>{item.name}</Text>
                    <Text numberOfLines={1} size={11} color={theme['q-text-secondary']}>{item.singer}</Text>
                  </View>
                  <View style={{ ...styles.playFace, backgroundColor: theme['q-surface-tint'] }}>
                    <Icon name="play" color={theme['q-accent-text']} rawSize={13} />
                  </View>
                </TouchableOpacity>
            ))
            : <View style={styles.state}><Text size={12} color={theme['q-text-secondary']}>{t('search_daily_recommend_empty')}</Text></View>}
    </View>
  )
})

const styles = createStyle({
  container: {
    paddingTop: 18,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 16,
    borderWidth: 1,
    borderRadius: 20,
  },
  header: {
    marginBottom: 10,
  },
  titleContent: {
    flexShrink: 1,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 17,
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  item: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
  },
  cover: {
    width: 46,
    height: 46,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: 46,
    height: 46,
  },
  musicInfo: {
    flex: 1,
    paddingLeft: 11,
    gap: 2,
  },
  playFace: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  state: {
    minHeight: 82,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorAction: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
})
