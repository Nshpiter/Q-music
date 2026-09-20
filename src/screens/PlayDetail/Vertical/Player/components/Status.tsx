// import { useLrcPlay } from '@/plugins/lyric'
import { useStatusText } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'


export default () => {
  // const { text } = useLrcPlay()
  const statusText = useStatusText()
  const theme = useTheme()
  // console.log('render status')

  // const status = playerStatus.isPlay ? text : playerStatus.statusText

  return <Text style={styles.text} numberOfLines={1} size={11} color={theme['q-text-secondary']}>{statusText}</Text>
}

const styles = createStyle({
  text: {
    textAlign: 'center',
  },
})
