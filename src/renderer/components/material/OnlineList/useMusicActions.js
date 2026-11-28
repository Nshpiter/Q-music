import { useRouter } from '@common/utils/vueRouter'
import musicSdk from '@renderer/utils/musicSdk'
import { clipboardWriteText, openUrl } from '@common/utils/electron'
import { formatMusicName, toOldMusicInfo } from '@renderer/utils'
import { addDislikeInfo, hasDislike } from '@renderer/core/dislikeList'
import { playNext } from '@renderer/core/player'
import { playMusicInfo } from '@renderer/store/player/state'
import { appSetting } from '@renderer/store/setting'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@renderer/plugins/i18n'


export default ({ props }) => {
  const router = useRouter()
  const t = useI18n()

  const handleSearch = index => {
    const info = props.list[index]
    router.push({
      path: '/search',
      query: {
        text: `${info.name} ${info.singer}`,
      },
    })
  }

  const handleCopyName = index => {
    const minfo = props.list[index]
    if (!minfo) return
    clipboardWriteText(formatMusicName(appSetting['download.fileName'], minfo.name, minfo.singer))
  }

  const handleOpenMusicDetail = index => {
    const minfo = props.list[index]
    const url = musicSdk[minfo.source]?.getMusicDetailPageUrl?.(toOldMusicInfo(minfo))
    if (!url) return
    openUrl(url)
  }

  const handleDislikeMusic = async(index) => {
    const minfo = props.list[index]
    const confirm = await dialog.confirm({
      message: minfo.singer ? t('lists__dislike_music_singer_tip', { name: minfo.name, singer: minfo.singer }) : t('lists__dislike_music_tip', { name: minfo.name }),
      cancelButtonText: t('cancel_button_text_2'),
      confirmButtonText: t('confirm_button_text'),
    })
    if (!confirm) return
    await addDislikeInfo([{ name: minfo.name, singer: minfo.singer }])
    if (hasDislike(playMusicInfo.musicInfo)) {
      playNext(true)
    }
  }


  return {
    handleSearch,
    handleCopyName,
    handleOpenMusicDetail,
    handleDislikeMusic,
  }
}
