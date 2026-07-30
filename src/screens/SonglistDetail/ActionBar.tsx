import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'

import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { handleCollect, handlePlay } from './listAction'
import songlistState from '@/store/songlist/state'
import { useI18n } from '@/lang'
import { useListInfo } from './state'
import { Icon } from '@/components/common/Icon'

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const info = useListInfo()

  const handlePlayAll = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handlePlay(info.id, info.source, songlistState.listDetailInfo.list)
  }

  const handleCollection = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handleCollect(info.id, info.source, songlistState.listDetailInfo.info.name || info.name)
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
          onPress={handleCollection}
          style={styles.controlBtn}
        >
          <Icon name="love" size={16} color={theme['q-accent-text']} />
          <Text style={styles.secondaryText} size={13} color={theme['q-accent-text']}>{t('collect_songlist')}</Text>
        </Button>
        <Button
          onPress={handlePlayAll}
          style={{
            ...styles.controlBtn,
            ...styles.primaryBtn,
            backgroundColor: theme['q-surface-tint'],
            borderLeftColor: theme['q-outline'],
          }}
        >
          <Icon name="play-outline" size={16} color={theme['q-accent-text']} />
          <Text style={styles.primaryText} size={13} color={theme['q-accent-text']}>{t('play_all')}</Text>
        </Button>
      </View>
    </View>
  )
})

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
    height: 44,
    flex: 1,
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
  },
  controlBtn: {
    height: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flex: 1.08,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  primaryText: {
    marginLeft: 7,
    fontWeight: '700',
  },
  secondaryText: {
    marginLeft: 7,
    fontWeight: '600',
  },
})

