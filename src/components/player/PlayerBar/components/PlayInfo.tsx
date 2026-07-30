import { memo, useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'

import Progress, { ProgressPlain } from '@/components/player/Progress'
import { useProgress } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { COMPONENT_IDS } from '@/config/constant'
import { usePageVisible } from '@/store/common/hook'
import { useBufferProgress } from '@/plugins/player'
import { useSettingValue } from '@/store/setting/hook'

const FONT_SIZE = 11
const PADDING_TOP_PROGRESS = 10

const PlayTimeCurrent = ({ timeStr }: { timeStr: string }) => {
  const theme = useTheme()
  return <Text style={styles.timeCurrent} size={FONT_SIZE} color={theme['q-text-primary']}>{timeStr}</Text>
}

const PlayTimeMax = memo(({ timeStr }: { timeStr: string }) => {
  const theme = useTheme()
  return <Text style={styles.timeMax} size={FONT_SIZE} color={theme['q-text-secondary']}>{timeStr}</Text>
})

export default ({ isHome }: { isHome: boolean }) => {
  const [autoUpdate, setAutoUpdate] = useState(true)
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime } = useProgress(autoUpdate)
  const buffered = useBufferProgress()
  const allowProgressBarSeek = useSettingValue('common.allowProgressBarSeek')

  usePageVisible([COMPONENT_IDS.home], useCallback((visible) => {
    if (isHome) setAutoUpdate(visible)
  }, [isHome]))

  return (
    <View style={styles.container}>
      <PlayTimeCurrent timeStr={nowPlayTimeStr} />
      <View style={styles.progress}>
        {
          allowProgressBarSeek
            ? <Progress progress={progress} duration={maxPlayTime} buffered={buffered} paddingTop={PADDING_TOP_PROGRESS} />
            : <ProgressPlain progress={progress} duration={maxPlayTime} buffered={buffered} paddingTop={PADDING_TOP_PROGRESS} />
        }
      </View>
      <PlayTimeMax timeStr={maxPlayTimeStr} />
    </View>
  )
}


const styles = StyleSheet.create({
  container: {
    height: 24,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progress: {
    flex: 1,
    height: 14,
    marginHorizontal: 8,
  },
  timeCurrent: {
    minWidth: 44,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  timeMax: {
    minWidth: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
})
