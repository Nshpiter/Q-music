import { memo, useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import commonState from '@/store/common/state'
import { pushMusicAccountScreen } from '@/navigation/navigation'
import { isMusicAccountConnected } from '@/core/musicAccount'

const MusicAccountEntry = memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    void Promise.all([isMusicAccountConnected('tx'), isMusicAccountConnected('wy')])
      .then(([tx, wy]) => { setConnected(tx || wy) })
      .catch(() => { setConnected(false) })
  }, [])

  return (
    <View style={styles.content}>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={() => {
          if (commonState.componentIds.home) pushMusicAccountScreen(commonState.componentIds.home)
        }}
      >
        <View style={styles.labelWrap}>
          <Text style={styles.label}>{t('setting_music_account_title')}</Text>
          <Text size={11} color={theme['q-text-secondary']}>
            {connected == null ? '' : connected ? t('setting_music_account_connected') : t('setting_music_account_disconnected')}
          </Text>
        </View>
        <Text size={14} color={theme['q-text-secondary']}>{'›'}</Text>
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  labelWrap: {
    flexShrink: 1,
  },
  label: {
    fontSize: 14,
  },
})

export default MusicAccountEntry
