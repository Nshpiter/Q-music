import { ref, computed } from '@common/utils/vueTools'
import { playMusicInfo, playInfo } from '@renderer/store/player/state'
import { getDownloadList } from '@renderer/store/download/action'
import { LIST_IDS } from '@common/constants'


export default () => {
  const dom_listContent = ref(null)

  const listAll = ref([])
  getDownloadList().then(l => {
    listAll.value = l
  })

  const playTaskId = computed(() => playMusicInfo.listId == LIST_IDS.DOWNLOAD ? listAll.value[playInfo.playIndex]?.id : '')


  return {
    dom_listContent,
    listAll,
    playTaskId,
  }
}
