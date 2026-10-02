import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'

import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { handleCollect, handlePlay } from './listAction'
import songlistState from '@/store/songlist/state'
import { useI18n } from '@/lang'
import { useListInfo } from './state'
import { Icon } from '@/components/common/Icon'
import { Q_UI } from '@/theme/ui'
import Loading from '@/components/common/Loading'
import { toast } from '@/utils/tools'

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const info = useListInfo()
  const [pendingAction, setPendingAction] = useState<'play' | 'collect' | null>(null)
  const pendingActionRef = useRef<'play' | 'collect' | null>(null)
  const mountedRef = useRef(true)
  const detail = songlistState.listDetailInfo
  const detailMatches = detail.id == info.id && detail.source == info.source
  const canPlay = detailMatches && detail.list.length > 0
  const loadedName = detailMatches ? detail.info.name?.trim() : undefined
  const collectionName = loadedName?.length ? loadedName : info.name

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const runAction = async(action: 'play' | 'collect', task: () => Promise<void>) => {
    if (pendingActionRef.current) return
    pendingActionRef.current = action
    setPendingAction(action)
    try {
      await task()
    } catch (error) {
      console.warn('[songlist] action failed', action, error)
      if (mountedRef.current) toast(t('load_failed'))
    } finally {
      pendingActionRef.current = null
      if (mountedRef.current) setPendingAction(null)
    }
  }

  const handlePlayAll = () => {
    if (!canPlay) return
    void runAction('play', async() => { await handlePlay(info.id, info.source, detail.list) })
  }

  const handleCollection = () => {
    if (!collectionName || !info.id) return
    void runAction('collect', async() => { await handleCollect(info.id, info.source, collectionName) })
  }

  return (
    <View style={styles.container}>
      <View
        style={{
          ...styles.group,
          backgroundColor: theme['q-surface-raised'],
          borderColor: theme['q-outline'],
        }}
      >
        <Button
          accessibilityLabel={t('play_all')}
          accessibilityState={{ busy: pendingAction == 'play' }}
          disabled={!canPlay || pendingAction != null}
          onPress={handlePlayAll}
          style={{
            ...styles.controlBtn,
            ...styles.primaryBtn,
            backgroundColor: theme['q-surface-tint'],
          }}
        >
          {pendingAction == 'play' ? <Loading size={16} color={theme['q-accent-text']} /> : <Icon accessible={false} name="play-outline" size={16} color={theme['q-accent-text']} />}
          <Text style={styles.primaryText} numberOfLines={1} size={13} color={theme['q-accent-text']}>{t(pendingAction == 'play' ? 'loading' : 'play_all')}</Text>
        </Button>
        <Button
          accessibilityLabel={t('collect_songlist')}
          accessibilityState={{ busy: pendingAction == 'collect' }}
          disabled={!collectionName || !info.id || pendingAction != null}
          onPress={handleCollection}
          style={{ ...styles.controlBtn, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme['q-outline'] }}
        >
          {pendingAction == 'collect' ? <Loading size={16} color={theme['q-accent-text']} /> : <Icon accessible={false} name="love" size={16} color={theme['q-accent-text']} />}
          <Text style={styles.secondaryText} numberOfLines={1} size={13} color={theme['q-accent-text']}>{t(pendingAction == 'collect' ? 'loading' : 'collect_songlist')}</Text>
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  group: {
    width: '100%',
    maxWidth: 560,
    minHeight: Q_UI.touchSize,
    flex: 1,
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Q_UI.radius.control,
    overflow: 'hidden',
  },
  controlBtn: {
    minHeight: Q_UI.touchSize,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flex: 1.2,
  },
  primaryText: {
    flexShrink: 1,
    marginLeft: 7,
    fontWeight: '700',
  },
  secondaryText: {
    flexShrink: 1,
    marginLeft: 7,
    fontWeight: '600',
  },
})

