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
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'

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

  useEffect(() => () => {
    isUnmountedRef.current = true
  }, [])

  const load = useCallback(async(source: Source, force = false) => {
    sourceRef.current = source
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const nextList = await getDailyRecommend(source, force)
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      setList(nextList)
    } catch {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      setList([])
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
          <Button style={{ ...styles.action, backgroundColor: theme['q-surface-tint'] }} onPress={() => { void load(sourceRef.current, true) }}>
            <Text size={12} color={theme['q-accent-text']}>{t('search_daily_recommend_refresh')}</Text>
          </Button>
          <Button style={{ ...styles.action, backgroundColor: theme['q-accent'] }} onPress={() => { void handlePlay() }}>
            <Text size={12} color={theme['q-on-accent']}>{t('search_daily_recommend_play')}</Text>
          </Button>
        </View>
      </View>
      {loading
        ? <View style={styles.state}><ActivityIndicator color={theme['q-accent']} /><Text size={12} color={theme['q-text-secondary']}>{t('search_daily_recommend_loading')}</Text></View>
        : list.length
          ? list.slice(0, 5).map((item, index) => (
              <TouchableOpacity key={item.id} style={styles.item} activeOpacity={0.65} onPress={() => { void handlePlay(index) }}>
                <Text style={styles.index} size={12} color={theme['q-accent-text']}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.musicInfo}>
                  <Text numberOfLines={1} size={14} color={theme['q-text-primary']}>{item.name}</Text>
                  <Text numberOfLines={1} size={11} color={theme['q-text-secondary']}>{item.singer}</Text>
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
    paddingBottom: 12,
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
    minHeight: 34,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  item: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  index: {
    width: 30,
    fontWeight: '700',
  },
  musicInfo: {
    flex: 1,
    gap: 2,
  },
  state: {
    minHeight: 82,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
