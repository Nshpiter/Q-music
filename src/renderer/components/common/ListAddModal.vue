<template>
  <material-modal :heading="$t(isMove ? 'list_add__title_first_move' : 'favorite_picker_title')" max-height="min(640px, calc(100% - 48px))" :show="show" :bg-close="bgClose && !busy && !creating" :close-btn="!busy && !creating" :teleport="teleport == '#view' ? '#root' : teleport" width="620px" max-width="calc(100% - 32px)" min-width="0" @close="handleClose">
    <main :class="$style.main">
      <header :class="$style.header"><p><strong>{{ currentMusicInfo.name }}</strong><span>{{ currentMusicInfo.singer }}</span></p></header>
      <QQFavoriteTarget v-if="show && !isMove && currentMusicInfo.id" :music-info="currentMusicInfo" :disabled="busy || creating" @busy="busy = $event; cloudBusy = $event" />
      <div :class="$style.localHeading"><h3>{{ $t('favorite_local_section') }}</h3><p>{{ $t(isMove ? 'favorite_move_hint' : 'favorite_local_hint') }}</p></div>
      <ListTargetPicker :lists="lists" :active="show" :disabled="busy" :show-status="!cloudBusy" @select="handleSelect" @creating="creating = $event" />
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
import QQFavoriteTarget from './QQFavoriteTarget.vue'

export default {
  components: { ListTargetPicker, QQFavoriteTarget },
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
    const cloudBusy = ref(false)
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
    return { lists, currentMusicInfo, busy, cloudBusy, creating, error, handleClose, handleSelect }
  },
}
</script>

<style lang="less" module>
.main { display: flex; flex-direction: column; min-height: 0; }
.header { flex: none; padding: 0 20px 18px; }
.header p { display: flex; flex-direction: column; gap: 6px; margin: 0; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.header p span { color: var(--color-font-label); font-size: 12px; }
.localHeading { margin: 0 20px 12px; flex: none; color: var(--color-font-label); }
.localHeading h3 { margin: 0; font-size: 11px; font-weight: 600; }
.localHeading p { margin: 6px 0 0; font-size: 11px; line-height: 1.5; }
.error { margin: 0; padding: 0 16px 14px; color: var(--color-primary); font-size: 12px; line-height: 1.5; }
</style>
