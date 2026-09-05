import { StyleSheet } from 'react-native'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import { LIST_IDS, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import Image from '@/components/common/Image'
import { useCallback } from 'react'
import { setLoadErrorPicUrl, setMusicInfo } from '@/core/player/playInfo'
import { useTheme } from '@/store/theme/hook'
import { Q_UI } from '@/theme/ui'
import Button from '@/components/common/Button'

const PIC_HEIGHT = Math.max(scaleSizeH(52), 52)

const styles = StyleSheet.create({
  button: {
    width: PIC_HEIGHT,
    height: PIC_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Q_UI.radius.cover,
    overflow: 'hidden',
  },
  image: {
    width: PIC_HEIGHT,
    height: PIC_HEIGHT,
    borderRadius: Q_UI.radius.cover,
    borderWidth: 1,
  },
})

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

  const handleError = useCallback((url: string | number) => {
    setLoadErrorPicUrl(url as string)
    setMusicInfo({
      pic: null,
    })
  }, [])

  return (
    <Button
      accessibilityLabel={musicInfo.id ? `${musicInfo.name} · ${musicInfo.singer}` : global.i18n.t('play_detail_setting_title')}
      style={styles.button}
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
