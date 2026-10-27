import RNFS from 'react-native-fs'
import settingState from '@/store/setting/state'
import { updateSetting } from '@/core/common'
import { requestStoragePermission } from '@/utils/tools'

export const DEFAULT_DOWNLOAD_DIRECTORY = `${RNFS.ExternalStorageDirectoryPath}/Music/QMusic`

export const normalizeDownloadDirectory = (path: string) => {
  const value = path.trim().replace(/\/+$/, '')
  // 文件夹选择器返回本地绝对路径；content URI 不能交给 RNFS 的移动文件接口。
  if (!value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f]/.test(value) || value.split('/').some(part => part == '..' || part == '.')) throw new Error('download_directory_invalid') // eslint-disable-line no-control-regex
  return value.replace(/\/{2,}/g, '/')
}

export const getDownloadDirectory = () => {
  const selected = settingState.setting['download.directory']
  if (!selected) return DEFAULT_DOWNLOAD_DIRECTORY
  try { return normalizeDownloadDirectory(selected) } catch { return DEFAULT_DOWNLOAD_DIRECTORY }
}

export const saveDownloadDirectory = async(path: string) => {
  const directory = normalizeDownloadDirectory(path)
  if (!await requestStoragePermission()) throw new Error('storage_all_files_unconfirmed')
  await RNFS.mkdir(directory)
  const info = await RNFS.stat(directory)
  if (!info.isDirectory()) throw new Error('download_directory_invalid')
  const probe = `${directory}/.qmusic-write-check-${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    await RNFS.writeFile(probe, '', 'utf8')
  } finally {
    if (await RNFS.exists(probe)) await RNFS.unlink(probe)
  }
  // 只有写入和清理检查均成功才保存，失败时保留原目录。
  updateSetting({ 'download.directory': directory == DEFAULT_DOWNLOAD_DIRECTORY ? '' : directory })
}
