import { StyleSheet } from 'react-native'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import { LIST_IDS, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import Image from '@/components/common/Image'
import { useCallback } from 'react'
import { setLoadErrorPicUrl, setMusicInfo } from '@/core/player/playInfo'
import { useTheme } from '@/store/theme/hook'
import { Q_UI } from '@/theme/ui'
import Button from '@/components/common/Button'

const PIC_HEIGHT = 34

const styles = StyleSheet.create({
  button: {
    flexShrink: 0,
    width: PIC_HEIGHT,
    height: PIC_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Q_UI.radius.item,
    overflow: 'hidden',
  },
  image: {
    width: PIC_HEIGHT,
    height: PIC_HEIGHT,
    borderRadius: Q_UI.radius.item,
    borderWidth: 1,
  },
})

export default ({ isHome, onOpenDetail }: { isHome: boolean, onOpenDetail?: () => void }) => {
  const musicInfo = usePlayerMusicInfo()
  const theme = useTheme()
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

  const handleError = useCallback((url: string | number) => {
    setLoadErrorPicUrl(url as string)
    setMusicInfo({
      pic: null,
    })
  }, [])

  return (
    <Button
      ripple={null}
      accessibilityLabel={musicInfo.id ? `${musicInfo.name} · ${musicInfo.singer}` : global.i18n.t('play_detail_setting_title')}
      style={styles.button}
      hitSlop={5}
      onLongPress={handleLongPress}
      onPress={handlePress}
      disabled={!musicInfo.id}
    >
      <Image
        url={musicInfo.pic}
        nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic}
        style={{ ...styles.image, borderColor: theme['q-outline'] }}
        onError={handleError}
      />
    </Button>
  )
}


// const styles = StyleSheet.create({
//   playInfoImg: {

//   },
// })
