import { useRef } from 'react'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { View } from 'react-native'
import PlayModeBtn from './PlayModeBtn'
import MusicAddBtn from './MusicAddBtn'
import DesktopLyricBtn from './DesktopLyricBtn'
import CommentBtn from './CommentBtn'
import PlayQueue, { type PlayQueueType } from '@/components/player/PlayQueue'
import Btn from './Btn'

export default () => {
  const t = useI18n()
  const queueRef = useRef<PlayQueueType>(null)

  return (
    <View style={styles.container}>
      <DesktopLyricBtn />
      <MusicAddBtn />
      <PlayModeBtn />
      <CommentBtn />
      <Btn icon="play-outline" accessibilityLabel={t('play_queue_title')} onPress={() => { queueRef.current?.show() }} />
      <PlayQueue ref={queueRef} />
    </View>
  )
}


const styles = createStyle({
  container: {
    // flexShrink: 0,
    // flexGrow: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
})
