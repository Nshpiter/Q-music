import { useMemo, useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import { type Position } from '@/components/common/Menu'
import SongMenuSheet from '@/components/SongMenuSheet'
import { buildAndroidSongMenus } from '@/utils/songMenu'
import { hasDislike } from '@/core/dislikeList'
import musicSdk from '@/utils/musicSdk'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfoOnline
  selectedList: LX.Music.MusicInfoOnline[]
  index: number
  single: boolean
}
const initSelectInfo = {}

export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onPlayNext: (selectInfo: SelectInfo) => void
  onPlayLater: (selectInfo: SelectInfo) => void
  onDownload: (selectInfo: SelectInfo) => void
  onAdd: (selectInfo: SelectInfo) => void
  onCopyName: (selectInfo: SelectInfo) => void
  onMusicSourceDetail: (selectInfo: SelectInfo) => void
  onDislikeMusic: (selectInfo: SelectInfo) => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

export default forwardRef<ListMenuType, ListMenuProps>((props: ListMenuProps, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const [menuMusic, setMenuMusic] = useState<LX.Music.MusicInfoOnline | null>(null)
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo)
  const [isDislikeMusic, setDislikeMusic] = useState(false)

  useImperativeHandle(ref, () => ({
    show(selectInfo, _position) {
      selectInfoRef.current = selectInfo
      setMenuMusic(selectInfo.musicInfo)
      setDislikeMusic(hasDislike(selectInfo.musicInfo))
      setVisible(true)
    },
  }))

  const menus = useMemo(() => {
    return buildAndroidSongMenus({
      t,
      control: {
        play: true,
        playNext: true,
        playLater: true,
        add: true,
        download: true,
        copyName: true,
        musicSourceDetail: !!menuMusic && !!musicSdk[menuMusic.source]?.getMusicDetailPageUrl,
        dislike: !isDislikeMusic,
      },
    })
  }, [t, isDislikeMusic, menuMusic])

  const handleMenuPress = ({ action }: { action: string }) => {
    const selectInfo = selectInfoRef.current
    switch (action) {
      case 'play':
        props.onPlay(selectInfo)
        break
      case 'playNext':
        props.onPlayNext(selectInfo)
        break
      case 'playLater':
        props.onPlayLater(selectInfo)
        break
      case 'download':
        props.onDownload(selectInfo)
        break
      case 'add':
        props.onAdd(selectInfo)
        break
      case 'copyName':
        props.onCopyName(selectInfo)
        break
      case 'musicSourceDetail':
        props.onMusicSourceDetail(selectInfo)
        break
      case 'dislike':
        props.onDislikeMusic(selectInfo)
        break
      default:
        break
    }
  }

  return (
    <SongMenuSheet
      visible={visible}
      musicInfo={menuMusic}
      menus={menus}
      onClose={() => { setVisible(false) }}
      onSelect={handleMenuPress}
    />
  )
})
