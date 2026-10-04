import { Animated, StyleSheet } from 'react-native'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useGlassColors } from '@/components/common/GlassSurface'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import Button from '@/components/common/Button'
import { useTrackChangeAnimation } from '@/components/player/useTrackChangeAnimation'


export default ({ isHome, onOpenDetail }: { isHome: boolean, onOpenDetail?: () => void }) => {
  const musicInfo = usePlayerMusicInfo()
  const colors = useGlassColors()
  const trackAnimation = useTrackChangeAnimation(musicInfo.id)

  const handlePress = () => {
    // console.log('')
    // console.log(playMusicInfo)
    if (!musicInfo.id) return
    if (onOpenDetail) { onOpenDetail(); return }
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
      ripple={null}
      accessibilityLabel={musicInfo.id ? `${title} · ${singer}` : global.i18n.t('play_detail_setting_title')}
      style={styles.container}
      onLongPress={handleLongPress}
      onPress={handlePress}
      disabled={!musicInfo.id}
    >
      <Animated.View style={trackAnimation}>
        <Text style={styles.title} size={13} color={colors.primary} numberOfLines={1}>{title}</Text>
        <Text style={styles.singer} size={10} color={colors.secondary} numberOfLines={1}>{singer}</Text>
      </Animated.View>
    </Button>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    minWidth: 0,
    height: 48,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
  },
  singer: {
    marginTop: 3,
  },
})
