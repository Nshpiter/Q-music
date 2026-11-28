import type { SongMenuActionItem } from '@/components/SongMenuSheet'

export interface AndroidSongMenuControl {
  play?: boolean
  playNext?: boolean
  playLater?: boolean
  add?: boolean
  move?: boolean
  changePosition?: boolean
  editMetadata?: boolean
  toggleSource?: boolean
  download?: boolean
  copyName?: boolean
  musicSourceDetail?: boolean
  dislike?: boolean
  remove?: boolean
}

/**
 * 统一构造安卓端歌曲底部菜单顺序与文案，保证搜索、歌单和播放历史体验一致。
 */
export function buildAndroidSongMenus({
  t,
  control,
  includePlay = true,
  includePlayNext = true,
  includePlayLater = true,
  includeAdd = true,
  includeMove = false,
  includeChangePosition = false,
  includeEditMetadata = false,
  includeToggleSource = false,
  includeDownload = true,
  includeCopyName = true,
  includeMusicSourceDetail = true,
  includeDislike = true,
  includeRemove = false,
}: {
  t: (key: any) => string
  control: AndroidSongMenuControl
  includePlay?: boolean
  includePlayNext?: boolean
  includePlayLater?: boolean
  includeAdd?: boolean
  includeMove?: boolean
  includeChangePosition?: boolean
  includeEditMetadata?: boolean
  includeToggleSource?: boolean
  includeDownload?: boolean
  includeCopyName?: boolean
  includeMusicSourceDetail?: boolean
  includeDislike?: boolean
  includeRemove?: boolean
}): SongMenuActionItem[] {
  const items: SongMenuActionItem[] = []
  if (includePlay) items.push({ action: 'play', label: t('play'), icon: 'play-outline', disabled: control.play === false })
  if (includePlayNext) items.push({ action: 'playNext', label: t('song_play_next'), icon: 'nextMusic', disabled: control.playNext === false })
  if (includePlayLater) items.push({ action: 'playLater', label: t('play_later'), icon: 'music_time', disabled: control.playLater === false })
  if (includeAdd) items.push({ action: 'add', label: t('add_to'), icon: 'love', disabled: control.add === false })
  if (includeMove) items.push({ action: 'move', label: t('move_to'), icon: 'folder', disabled: control.move === false })
  if (includeChangePosition) items.push({ action: 'changePosition', label: t('change_position'), icon: 'reorder', disabled: control.changePosition === false })
  if (includeEditMetadata) items.push({ action: 'editMetadata', label: t('edit_metadata'), icon: 'edit', disabled: control.editMetadata === false })
  if (includeToggleSource) items.push({ action: 'toggleSource', label: t('toggle_source'), icon: 'exchange', disabled: control.toggleSource === false })
  if (includeDownload) items.push({ action: 'download', label: t('download'), icon: 'download-2', disabled: control.download === false })
  if (includeCopyName) items.push({ action: 'copyName', label: t('copy_name'), icon: 'share', disabled: control.copyName === false })
  if (includeMusicSourceDetail) items.push({ action: 'musicSourceDetail', label: t('music_source_detail'), icon: 'album', disabled: control.musicSourceDetail === false })
  if (includeDislike) items.push({ action: 'dislike', label: t('dislike'), icon: 'dislike', disabled: control.dislike === false })
  if (includeRemove) items.push({ action: 'remove', label: t('delete'), icon: 'close', danger: true, disabled: control.remove === false })
  return items
}
