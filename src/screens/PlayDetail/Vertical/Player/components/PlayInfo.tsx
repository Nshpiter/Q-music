import { memo, useState } from 'react'
import { Pressable, View } from 'react-native'

import Progress from '@/components/player/ProgressBar'
import Status from './Status'
import { useProgress } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useBufferProgress } from '@/plugins/player'
import { formatPlayTime2 } from '@/utils'

const PlayTimeCurrent = ({ timeStr }: { timeStr: string }) => {
  const theme = useTheme()
  return <Text size={11} style={styles.timeText} color={theme['q-text-secondary']}>{timeStr}</Text>
}

const PlayTimeMax = memo(({ timeStr, onToggle }: { timeStr: string, onToggle: () => void }) => {
  const theme = useTheme()
  return (
    <Pressable hitSlop={8} accessibilityRole="button" onPress={onToggle}>
      <Text size={11} style={styles.timeText} color={theme['q-text-secondary']}>{timeStr}</Text>
    </Pressable>
  )
})

export default () => {
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime, nowPlayTime } = useProgress()
  const buffered = useBufferProgress()
  const [showRemaining, setShowRemaining] = useState(false)
  const rightTimeStr = showRemaining && Number.isFinite(maxPlayTime) && maxPlayTime > 0
    ? `-${formatPlayTime2(Math.max(0, maxPlayTime - nowPlayTime))}`
    : maxPlayTimeStr

  return (
    <>
      <View style={styles.progress}><Progress progress={progress} duration={maxPlayTime} buffered={buffered} /></View>
      <View style={styles.info}>
        <PlayTimeCurrent timeStr={nowPlayTimeStr} />
        <View style={styles.status} >
          <Status />
        </View>
        <PlayTimeMax timeStr={rightTimeStr} onToggle={() => { setShowRemaining(v => !v) }} />
      </View>
    </>
  )
}


const styles = createStyle({
  progress: {
    flexGrow: 1,
    flexShrink: 0,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontVariant: ['tabular-nums'],
  },
  status: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
    paddingRight: 10,
  },
})
