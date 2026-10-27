import { createStyle } from '@/utils/tools'
import { View } from 'react-native'
import MusicAddBtn from './MusicAddBtn'
import CommentBtn from './CommentBtn'
import { SongMoreButton } from '../../../../components/SongActions'

export default () => {
  return (
    <View style={styles.container}>
      <MusicAddBtn />
      <CommentBtn />
      <SongMoreButton />
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
