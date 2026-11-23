import { computed, ref } from '@common/utils/vueTools'
import { downloadStatus } from '@renderer/store/download/state'

const statusTabs = {
  [downloadStatus.RUN]: 'running',
  [downloadStatus.WAITING]: 'running',
  [downloadStatus.PAUSE]: 'paused',
  [downloadStatus.ERROR]: 'error',
  [downloadStatus.COMPLETED]: 'finished',
}

export default (listAll) => {
  const activeTab = ref('all')
  const groups = computed(() => {
    const result = { all: listAll.value, running: [], paused: [], error: [], finished: [] }
    for (const task of listAll.value) {
      if (task && statusTabs[task.status]) result[statusTabs[task.status]].push(task)
    }
    return result
  })
  const tabs = computed(() => Object.entries(groups.value).map(([id, tasks]) => ({
    id,
    label: `${window.i18n.t('download__' + id)} (${tasks.length})`,
  })))
  const list = computed(() => groups.value[activeTab.value])
  return { tabs, activeTab, list }
}
