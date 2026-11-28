import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import { type Position } from '@/components/common/Menu'
import SongMenuSheet, { type SongMenuActionItem } from '@/components/SongMenuSheet'
import { buildAndroidSongMenus } from '@/utils/songMenu'
import { hasDislike } from '@/core/dislikeList'
import { existsFile } from '@/utils/fs'
import musicSdk from '@/utils/musicSdk'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfo
  selectedList: LX.Music.MusicInfo[]
  index: number
  listId: string
  single: boolean
}
const initSelectInfo = {}

export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onPlayNext: (selectInfo: SelectInfo) => void
  onPlayLater: (selectInfo: SelectInfo) => void
  onDownload: (selectInfo: SelectInfo) => void
  onAdd: (selectInfo: SelectInfo) => void
  onMove: (selectInfo: SelectInfo) => void
  onEditMetadata: (selectInfo: SelectInfo) => void
  onCopyName: (selectInfo: SelectInfo) => void
  onChangePosition: (selectInfo: SelectInfo) => void
  onToggleSource: (selectInfo: SelectInfo) => void
  onMusicSourceDetail: (selectInfo: SelectInfo) => void
  onDislikeMusic: (selectInfo: SelectInfo) => void
  onRemove: (selectInfo: SelectInfo) => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

const hasEditMetadata = async(musicInfo: LX.Music.MusicInfo) => {
  if (musicInfo.source != 'local') return false
  return existsFile(musicInfo.meta.filePath)
}

export default forwardRef<ListMenuType, ListMenuProps>((props, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const [menuMusic, setMenuMusic] = useState<LX.Music.MusicInfo | null>(null)
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo)
  const [menus, setMenus] = useState<SongMenuActionItem[]>([])

  useImperativeHandle(ref, () => ({
    show(selectInfo, _position) {
      selectInfoRef.current = selectInfo
      setMenuMusic(selectInfo.musicInfo)
      handleSetMenu(selectInfo.musicInfo)
      setVisible(true)
    },
  }))

  const handleSetMenu = (musicInfo: LX.Music.MusicInfo) => {
    const canDownload = (selectInfoRef.current.selectedList.length ? selectInfoRef.current.selectedList : [musicInfo]).some(item => item.source != 'local')
    const baseMenus = buildAndroidSongMenus({
      t,
      control: {
        play: true,
        playNext: true,
        playLater: true,
        add: true,
        move: true,
        changePosition: true,
        editMetadata: false,
        toggleSource: true,
        download: canDownload,
        copyName: true,
        musicSourceDetail: musicInfo.source != 'local' && !!musicSdk[musicInfo.source]?.getMusicDetailPageUrl,
        dislike: !hasDislike(musicInfo),
        remove: true,
      },
      includeMove: true,
      includeChangePosition: true,
      includeEditMetadata: musicInfo.source == 'local',
      includeToggleSource: true,
      includeRemove: true,
    })
    setMenus(baseMenus)
    if (musicInfo.source == 'local') {
      void hasEditMetadata(musicInfo).then(canEdit => {
        if (!canEdit || selectInfoRef.current.musicInfo?.id != musicInfo.id) return
        setMenus(prev => prev.map(item => item.action == 'editMetadata' ? { ...item, disabled: false } : item))
      })
    }
  }

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
      case 'add':
        props.onAdd(selectInfo)
        break
      case 'download':
        props.onDownload(selectInfo)
        break
      case 'move':
        props.onMove(selectInfo)
        break
      case 'editMetadata':
        props.onEditMetadata(selectInfo)
        break
      case 'copyName':
        props.onCopyName(selectInfo)
        break
      case 'changePosition':
        props.onChangePosition(selectInfo)
        break
      case 'toggleSource':
        props.onToggleSource(selectInfo)
        break
      case 'musicSourceDetail':
        props.onMusicSourceDetail(selectInfo)
        break
      case 'dislike':
        props.onDislikeMusic(selectInfo)
        break
      case 'remove':
        props.onRemove(selectInfo)
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
