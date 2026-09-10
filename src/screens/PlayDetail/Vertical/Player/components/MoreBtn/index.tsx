import { useRef } from 'react'
import { createStyle } from '@/utils/tools'
import { View } from 'react-native'
import PlayModeBtn from './PlayModeBtn'
import MusicAddBtn from './MusicAddBtn'
import DesktopLyricBtn from './DesktopLyricBtn'
import CommentBtn from './CommentBtn'
import QualityBadge from '@/screens/PlayDetail/components/QualityBadge'
import PlayQueue, { type PlayQueueType } from '@/components/player/PlayQueue'
import Btn from './Btn'

export default () => {
  const queueRef = useRef<PlayQueueType>(null)

  return (
    <View style={styles.container}>
      <QualityBadge />
      <DesktopLyricBtn />
      <MusicAddBtn />
      <PlayModeBtn />
      <CommentBtn />
      <Btn icon="play-outline" onPress={() => { queueRef.current?.show() }} />
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
