import { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'

import Progress, { ProgressPlain } from '@/components/player/Progress'
import { useProgress } from '@/store/player/hook'
import { COMPONENT_IDS } from '@/config/constant'
import { usePageVisible } from '@/store/common/hook'
import { useBufferProgress } from '@/plugins/player'
import { useSettingValue } from '@/store/setting/hook'

const PADDING_TOP_PROGRESS = 5

export default ({ isHome }: { isHome: boolean }) => {
  const [autoUpdate, setAutoUpdate] = useState(true)
  const { progress, maxPlayTime } = useProgress(autoUpdate)
  const buffered = useBufferProgress()
  const allowProgressBarSeek = useSettingValue('common.allowProgressBarSeek')

  usePageVisible([COMPONENT_IDS.home], useCallback((visible) => {
    if (isHome) setAutoUpdate(visible)
  }, [isHome]))

  return (
    <View style={styles.container}>
      <View style={styles.progress}>
        {
          allowProgressBarSeek
            ? <Progress progress={progress} duration={maxPlayTime} buffered={buffered} paddingTop={PADDING_TOP_PROGRESS} />
            : <ProgressPlain progress={progress} duration={maxPlayTime} buffered={buffered} paddingTop={PADDING_TOP_PROGRESS} />
        }
      </View>
    </View>
  )
}


const styles = StyleSheet.create({
  container: {
    height: 7,
    marginTop: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progress: {
    flex: 1,
    height: 7,
    marginHorizontal: 10,
  },
})
