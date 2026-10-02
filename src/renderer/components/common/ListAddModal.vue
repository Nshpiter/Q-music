<template>
  <material-modal :show="show" :bg-close="bgClose && !busy && !creating" :close-btn="!busy && !creating" :teleport="teleport" width="620px" max-width="calc(100% - 32px)" min-width="0" @close="handleClose">
    <main :class="$style.main">
      <h2>{{ $t('list_add__' + (isMove ? 'title_first_move' : 'title_first_add')) }} <span :class="$style.name">{{ currentMusicInfo.name }}</span> {{ $t('list_add__title_last') }}</h2>
      <ListTargetPicker :lists="lists" :active="show" :disabled="busy" @select="handleSelect" @creating="creating = $event" />
      <p v-if="error" :class="$style.error" role="alert">{{ error }}</p>
    </main>
  </material-modal>
</template>

<script>
import { watch, ref } from '@common/utils/vueTools'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { addListMusics, moveListMusics, getMusicExistListIds } from '@renderer/store/list/action'
import useKeyDown from '@renderer/utils/compositions/useKeyDown'
import { useI18n } from '@root/lang'
import ListTargetPicker from './ListTargetPicker.vue'

export default {
  components: { ListTargetPicker },
  props: {
    show: { type: Boolean, default: false },
    musicInfo: { type: [Object, null], required: true },
    bgClose: { type: Boolean, default: true },
    excludeListId: { type: Array, default: () => [] },
    fromListId: { type: String, default: null },
    isMove: { type: Boolean, default: false },
    teleport: { type: String, default: '#root' },
  },
  emits: ['update:show'],
  setup(props, { emit }) {
    const keyModDown = useKeyDown('mod')
    const t = useI18n()
    const lists = ref([])
    const currentMusicInfo = ref({})
    const busy = ref(false)
    const creating = ref(false)
    const error = ref('')
    const addedListIds = new Set()
    let requestId = 0
    let selectionVersion = 0

    const getList = () => {
      const id = ++requestId
      const musicId = currentMusicInfo.value.id
      lists.value = [
        { ...defaultList, name: t(defaultList.name) },
        { ...loveList, name: t(loveList.name) },
        ...userLists,
      ].filter(list => !props.excludeListId.includes(list.id)).map(list => ({ ...list, isExist: addedListIds.has(list.id) }))
      void getMusicExistListIds(musicId).then(ids => {
        if (id != requestId || !props.show || currentMusicInfo.value.id != musicId) return
        for (const list of lists.value) list.isExist = ids.includes(list.id) || addedListIds.has(list.id)
      }).catch(() => {})
    }
    watch(() => [props.show, props.musicInfo], ([show]) => {
      requestId++
      selectionVersion++
      if (!show) return
      error.value = ''
      addedListIds.clear()
      if (!props.musicInfo) { lists.value = []; return }
      currentMusicInfo.value = 'progress' in props.musicInfo ? props.musicInfo.metadata.musicInfo : props.musicInfo
      getList()
    }, { immediate: true })
    watch(userLists, () => { if (props.show && props.musicInfo) getList() })
    const handleClose = () => {
      if (!busy.value && !creating.value) emit('update:show', false)
    }
    const handleSelect = async(listId) => {
      const targetIndex = lists.value.findIndex(list => list.id == listId)
      if (busy.value || creating.value || !props.show || targetIndex < 0 || lists.value[targetIndex].isExist || !currentMusicInfo.value.id) return
      const keepOpen = keyModDown.value && !props.isMove
      const version = selectionVersion
      const musicInfo = currentMusicInfo.value
      busy.value = true
      error.value = ''
      try {
        if (props.isMove) await moveListMusics(props.fromListId, listId, [musicInfo])
        else await addListMusics(listId, [musicInfo])
        if (version != selectionVersion) return
        addedListIds.add(listId)
        const currentIndex = lists.value.findIndex(list => list.id == listId)
        if (currentIndex >= 0) lists.value[currentIndex].isExist = true
        if (!keepOpen) emit('update:show', false)
      } catch {
        if (version == selectionVersion) error.value = t('list_add__action_failed')
      } finally {
        busy.value = false
      }
    }
    return { lists, currentMusicInfo, busy, creating, error, handleClose, handleSelect }
  },
}
</script>

<style lang="less" module>
.main { display: flex; flex-direction: column; min-height: 0; }
.main h2 { flex: none; font-size: 14px; color: var(--color-font); line-height: 1.5; text-align: center; padding: 15px 20px; overflow-wrap: anywhere; }
.name { color: var(--color-primary); }
.error { margin: 0; padding: 0 16px 14px; color: var(--color-primary); font-size: 12px; line-height: 1.5; }
</style>
