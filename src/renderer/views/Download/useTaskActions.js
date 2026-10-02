import { useRouter } from '@common/utils/vueRouter'
import musicSdk from '@renderer/utils/musicSdk'
import { openUrl } from '@common/utils/electron'
import { checkPath, joinPath } from '@common/utils/nodejs'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting } from '@renderer/store/setting'
import { ref } from '@common/utils/vueTools'
import { toOldMusicInfo } from '@renderer/utils/index'
import { startDownloadTasks, pauseDownloadTasks, removeDownloadTasks } from '@renderer/store/download/action'
import { openDirInExplorer } from '@renderer/utils/ipc'

export default ({ list, selectedList, removeAllSelect }) => {
  const router = useRouter()
  const t = useI18n()
  const isBusy = ref(false)

  const handleSearch = index => {
    const info = list.value[index].metadata.musicInfo
    router.push({
      path: '/search',
      query: {
        text: `${info.name} ${info.singer}`,
      },
    })
  }

  const handleOpenMusicDetail = index => {
    const task = list.value[index]
    const mInfo = toOldMusicInfo(task.metadata.musicInfo)
    const url = musicSdk[mInfo.source]?.getMusicDetailPageUrl?.(mInfo)
    if (!url) return
    openUrl(url)
  }

  const runTaskAction = async(index, single, action) => {
    if (isBusy.value) return
    const multiple = selectedList.value.length && !single
    const tasks = multiple ? [...selectedList.value] : [list.value[index]].filter(Boolean)
    if (!tasks.length) return
    isBusy.value = true
    try {
      await action(tasks)
      if (multiple) removeAllSelect()
    } catch {
      await dialog({ message: t('download__action_failed') })
    } finally {
      isBusy.value = false
    }
  }
  const handleStartTask = (index, single) => runTaskAction(index, single, startDownloadTasks)
  const handlePauseTask = (index, single) => runTaskAction(index, single, pauseDownloadTasks)
  const handleRemoveTask = (index, single) => runTaskAction(index, single, tasks => removeDownloadTasks(tasks.map(task => task.id)))

  const handleOpenFile = async(index) => {
    const task = list.value[index]
    if (!task) return
    try {
      const savedPath = task.metadata.filePath
      const fallbackPath = joinPath(appSetting['download.savePath'], task.metadata.fileName)
      const path = savedPath && await checkPath(savedPath) ? savedPath : await checkPath(fallbackPath) ? fallbackPath : ''
      if (!path) {
        await dialog({ message: t('download__file_missing') })
        return
      }
      await openDirInExplorer(path)
    } catch {
      await dialog({ message: t('download__file_missing') })
    }
  }

  return {
    isBusy,
    handleSearch,
    handleOpenMusicDetail,
    handleStartTask,
    handlePauseTask,
    handleRemoveTask,
    handleOpenFile,
  }
}
