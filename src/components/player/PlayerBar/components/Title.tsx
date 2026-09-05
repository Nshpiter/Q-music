import { StyleSheet } from 'react-native'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import Button from '@/components/common/Button'


export default ({ isHome }: { isHome: boolean }) => {
  const musicInfo = usePlayerMusicInfo()
  const theme = useTheme()

  const handlePress = () => {
    // console.log('')
    // console.log(playMusicInfo)
    if (!musicInfo.id) return
    navigations.pushPlayDetailScreen(commonState.componentIds.home!)
    // toast(global.i18n.t('play_detail_todo_tip'), 'long')
  }

  const handleLongPress = () => {
    if (!isHome) return
    const listId = playerState.playMusicInfo.listId
    if (!listId || listId == LIST_IDS.DOWNLOAD) return
    global.app_event.jumpListPosition()
  }

  const title = musicInfo.id ? musicInfo.name : ''
  const singer = musicInfo.id ? musicInfo.singer : ''

  return (
    <Button
      accessibilityLabel={musicInfo.id ? `${title} · ${singer}` : global.i18n.t('play_detail_setting_title')}
      style={styles.container}
      onLongPress={handleLongPress}
      onPress={handlePress}
      disabled={!musicInfo.id}
    >
      <Text style={styles.title} size={15} color={theme['q-text-primary']} numberOfLines={1}>{title}</Text>
      <Text style={styles.singer} size={12} color={theme['q-text-secondary']} numberOfLines={1}>{singer}</Text>
    </Button>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
  },
  singer: {
    marginTop: 3,
  },
})
