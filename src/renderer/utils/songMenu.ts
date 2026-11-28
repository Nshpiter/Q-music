export interface SongMenuControl {
  play?: boolean
  playNext?: boolean
  playLater?: boolean
  addTo?: boolean
  moveTo?: boolean
  sort?: boolean
  toggleSource?: boolean
  download?: boolean
  copyName?: boolean
  search?: boolean
  sourceDetail?: boolean
  dislike?: boolean
  remove?: boolean
}

export interface SongMenuItem {
  name: string
  action: string
  disabled?: boolean
  hide?: boolean
}

/**
 * 统一构造桌面端歌曲菜单顺序，将常用播放与收藏操作固定在最前。
 */
export function buildSongMenus({
  t,
  isSelectionMode,
  isSelected,
  hasSelection = true,
  control,
  includePlay = true,
  includePlayNext = true,
  includePlayLater = true,
  includeAddTo = true,
  includeMoveTo = false,
  includeSort = false,
  includeToggleSource = false,
  includeDownload = true,
  includeCopyName = false,
  includeSearch = true,
  includeSourceDetail = true,
  includeDislike = true,
  includeRemove = false,
}: {
  t: (key:
  | 'list__play'
  | 'list__play_next'
  | 'list__play_later'
  | 'list__add_to'
  | 'list__move_to'
  | 'list__sort'
  | 'list__toggle_source'
  | 'list__download'
  | 'list__copy_name'
  | 'list__search'
  | 'list__source_detail'
  | 'list__dislike'
  | 'list__remove'
  | 'list__multi_select'
  | 'list__select_item'
  | 'list__unselect_item') => string
  isSelectionMode?: boolean
  isSelected?: boolean
  hasSelection?: boolean
  control: SongMenuControl
  includePlay?: boolean
  includePlayNext?: boolean
  includePlayLater?: boolean
  includeAddTo?: boolean
  includeMoveTo?: boolean
  includeSort?: boolean
  includeToggleSource?: boolean
  includeDownload?: boolean
  includeCopyName?: boolean
  includeSearch?: boolean
  includeSourceDetail?: boolean
  includeDislike?: boolean
  includeRemove?: boolean
}): SongMenuItem[] {
  const items: SongMenuItem[] = []
  if (includePlay) items.push({ name: t('list__play'), action: 'play', disabled: control.play === false })
  if (includePlayNext) items.push({ name: t('list__play_next'), action: 'playNext', disabled: control.playNext === false })
  if (includePlayLater) items.push({ name: t('list__play_later'), action: 'playLater', disabled: control.playLater === false })
  if (includeAddTo) items.push({ name: t('list__add_to'), action: 'addTo', disabled: control.addTo === false })
  if (includeMoveTo) items.push({ name: t('list__move_to'), action: 'moveTo', disabled: control.moveTo === false })
  if (includeSort) items.push({ name: t('list__sort'), action: 'sort', disabled: control.sort === false })
  if (includeToggleSource) items.push({ name: t('list__toggle_source'), action: 'toggleSource', disabled: control.toggleSource === false })
  if (includeDownload) items.push({ name: t('list__download'), action: 'download', disabled: control.download === false })
  if (hasSelection) {
    items.push({
      name: t(!isSelectionMode ? 'list__multi_select' : isSelected ? 'list__unselect_item' : 'list__select_item'),
      action: 'select',
    })
  }
  if (includeCopyName) items.push({ name: t('list__copy_name'), action: 'copyName', disabled: control.copyName === false })
  if (includeSearch) items.push({ name: t('list__search'), action: 'search', disabled: control.search === false })
  if (includeSourceDetail) items.push({ name: t('list__source_detail'), action: 'sourceDetail', disabled: control.sourceDetail === false })
  if (includeDislike) items.push({ name: t('list__dislike'), action: 'dislike', disabled: control.dislike === false })
  if (includeRemove) items.push({ name: t('list__remove'), action: 'remove', disabled: control.remove === false })
  return items
}
