import { memo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import Progress from '@/components/player/Progress'
import Status from './Status'
import { useProgress } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useBufferProgress } from '@/plugins/player'
import { formatPlayTime2 } from '@/utils'

const PlayTimeCurrent = ({ timeStr }: { timeStr: string }) => {
  const theme = useTheme()
  return <Text style={styles.timeText} color={theme['c-500']}>{timeStr}</Text>
}

const PlayTimeMax = memo(({ timeStr, onToggle }: { timeStr: string, onToggle: () => void }) => {
  const theme = useTheme()
  return (
    <Pressable hitSlop={8} accessibilityRole="button" onPress={onToggle}>
      <Text style={styles.timeText} color={theme['c-500']}>{timeStr}</Text>
    </Pressable>
  )
})

export default () => {
  const theme = useTheme()
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime, nowPlayTime } = useProgress()
  const buffered = useBufferProgress()
  const [showRemaining, setShowRemaining] = useState(false)
  const rightTimeStr = showRemaining && Number.isFinite(maxPlayTime) && maxPlayTime > 0
    ? `-${formatPlayTime2(Math.max(0, maxPlayTime - nowPlayTime))}`
    : maxPlayTimeStr

  return (
    <View style={styles.container}>
      <View style={styles.status} >
        <Status />
      </View>
      <View style={{ flexGrow: 0, flexShrink: 0, flexDirection: 'row' }} >
        <PlayTimeCurrent timeStr={nowPlayTimeStr} />
        <Text color={theme['c-500']}> / </Text>
        <PlayTimeMax timeStr={rightTimeStr} onToggle={() => { setShowRemaining(v => !v) }} />
      </View>
      <View style={[StyleSheet.absoluteFill, styles.progress]}><Progress progress={progress} duration={maxPlayTime} buffered={buffered} /></View>
    </View>
  )
}


const styles = createStyle({
  container: {
    // marginLeft: 15,
    marginVertical: 5,
    height: 26,
    // flex: 1,
    paddingVertical: 2,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
    paddingRight: 5,
  },
})
// const styles = createStyle({
//   container: {
//     flex: 1,
//     // height: 16,
//     // flexGrow: 0,
//     // flexShrink: 0,
//     // flexDirection: 'column',
//     // justifyContent: 'center',
//     // alignItems: 'center',
//     // marginBottom: -1,
//     // backgroundColor: '#ccc',
//     // overflow: 'hidden',
//     // height:
//     // position: 'absolute',
//     // width: '100%',
//     // top: 0,
//     paddingVertical: 2,
//     paddingHorizontal: 5,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//   },
//   progress: {
//     paddingVertical: 2,
//     zIndex: 100,
//   },
//   status: {
//     flexGrow: 1,
//     flexShrink: 1,
//     paddingRight: 5,
//   },
// })
