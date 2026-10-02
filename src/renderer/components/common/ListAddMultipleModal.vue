<template>
  <material-modal :show="show" :bg-close="bgClose && !busy && !creating" :close-btn="!busy && !creating" :teleport="teleport" width="620px" max-width="calc(100% - 32px)" min-width="0" @close="handleClose">
    <main :class="$style.main">
      <h2>{{ $t('list_add__multiple_' + (isMove ? 'title_move' : 'title_add'), { num: musicList.length }) }}</h2>
      <ListTargetPicker :lists="lists" :active="show" :disabled="busy" @select="handleSelect" @creating="creating = $event" />
      <p v-if="error" :class="$style.error" role="alert">{{ error }}</p>
    </main>
  </material-modal>
</template>

<script>
import { computed, ref, watch } from '@common/utils/vueTools'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { addListMusics, moveListMusics } from '@renderer/store/list/action'
import useKeyDown from '@renderer/utils/compositions/useKeyDown'
import { useI18n } from '@root/lang'
import ListTargetPicker from './ListTargetPicker.vue'

export default {
  components: { ListTargetPicker },
  props: {
    show: { type: Boolean, default: false },
    musicList: { type: Array, default: () => [] },
    bgClose: { type: Boolean, default: true },
    excludeListId: { type: Array, default: () => [] },
    fromListId: { type: String, default: null },
    isMove: { type: Boolean, default: false },
    teleport: { type: String, default: '#root' },
  },
  emits: ['update:show', 'confirm'],
  setup(props, { emit }) {
    const keyModDown = useKeyDown('mod')
    const t = useI18n()
    const busy = ref(false)
    const creating = ref(false)
    const error = ref('')
    const addedListIds = ref([])
    const lists = computed(() => [
      { ...defaultList, name: t(defaultList.name) },
      { ...loveList, name: t(loveList.name) },
      ...userLists,
    ].filter(list => !props.excludeListId.includes(list.id)).map(list => ({ ...list, isExist: addedListIds.value.includes(list.id) })))
    watch(() => props.show, show => {
      if (show) { error.value = ''; addedListIds.value = [] }
    })
    const handleClose = () => {
      if (!busy.value && !creating.value) emit('update:show', false)
    }
    const handleSelect = async(listId) => {
      if (busy.value || creating.value || !props.show || !props.musicList.length || addedListIds.value.includes(listId) || !lists.value.some(list => list.id == listId)) return
      const keepOpen = keyModDown.value && !props.isMove
      const musicList = props.musicList.map(item => 'progress' in item ? item.metadata.musicInfo : item)
      busy.value = true
      error.value = ''
      try {
        if (props.isMove) await moveListMusics(props.fromListId, listId, musicList)
        else await addListMusics(listId, musicList)
        addedListIds.value.push(listId)
        if (!keepOpen) { emit('update:show', false); emit('confirm') }
      } catch {
        error.value = t('list_add__action_failed')
      } finally {
        busy.value = false
      }
    }
    return { lists, busy, creating, error, handleClose, handleSelect }
  },
}
</script>

<style lang="less" module>
.main { display: flex; flex-direction: column; min-height: 0; }
.main h2 { flex: none; font-size: 14px; color: var(--color-font); line-height: 1.5; text-align: center; padding: 15px 20px; overflow-wrap: anywhere; }
.error { margin: 0; padding: 0 16px 14px; color: var(--color-primary); font-size: 12px; line-height: 1.5; }
</style>
