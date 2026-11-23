import { addListMusics, createUserList, getListMusics, setFetchingListStatus } from '@renderer/store/list/action'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { showSelectDialog } from '@renderer/utils/ipc'
import { localAudioExtensions, localFolderPlaylist } from '@common/utils/localMusicFiles'
import { dialog } from '@renderer/plugins/Dialog'


const listExists = (id: string) => [defaultList, loveList, ...userLists].some(list => list.id == id)

export const importLocalMusicFiles = async(filePaths: string[], options: {
  listId?: string
  folderFiles?: ReadonlySet<string>
  onProgress?: (current: number, total: number) => void
}) => {
  const paths = [...new Set(filePaths)]
  const music: LX.Music.MusicInfoLocal[] = []
  for (let start = 0; start < paths.length; start += 100) {
    music.push(...await window.lx.worker.main.createLocalMusicInfos(paths.slice(start, start + 100)))
    options.onProgress?.(Math.min(start + 100, paths.length), paths.length)
  }
  const groups = new Map<string, { name: string, music: LX.Music.MusicInfoLocal[] }>()
  for (const song of music) {
    const folder = options.folderFiles?.has(song.meta.filePath) ? localFolderPlaylist(song.meta.filePath) : { id: options.listId ?? 'local_music', name: window.i18n.t('local_import_title') }
    let group = groups.get(folder.id)
    if (!group) groups.set(folder.id, group = { name: folder.name, music: [] })
    group.music.push(song)
  }
  let added = 0
  let duplicates = 0
  for (const [id, group] of groups) {
    if (!listExists(id)) {
      if (id == options.listId) throw new Error('local_import_target_missing')
      await createUserList({ id, name: group.name })
    }
    const existing = new Set((await getListMusics(id)).map(song => song.id))
    const fresh = group.music.filter(song => {
      if (existing.has(song.id)) return false
      existing.add(song.id)
      return true
    })
    duplicates += group.music.length - fresh.length
    if (fresh.length) await addListMusics(id, fresh, 'bottom')
    added += fresh.length
  }
  return { added, duplicates, skipped: paths.length - music.length, lists: groups.size, firstListId: groups.keys().next().value }
}
export const addLocalFile = async(listInfo: LX.List.MyListInfo) => {
  const { canceled, filePaths } = await showSelectDialog({
    title: window.i18n.t('lists__add_local_file_desc'),
    properties: ['openFile', 'multiSelections'],
    filters: [
      // https://support.google.com/chromebook/answer/183093
      // 3gp, .avi, .mov, .m4v, .m4a, .mp3, .mkv, .ogm, .ogg, .oga, .webm, .wav
      { name: 'Audio', extensions: localAudioExtensions },
      // { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (canceled || !filePaths.length) return

  setFetchingListStatus(listInfo.id, true)
  try {
    const result = await importLocalMusicFiles(filePaths, { listId: listInfo.id })
    await dialog(window.i18n.t('local_import_result', { added: result.added, duplicates: result.duplicates, skipped: result.skipped }))
  } catch {
    await dialog(window.i18n.t('local_import_failed'))
  } finally { setFetchingListStatus(listInfo.id, false) }
}
