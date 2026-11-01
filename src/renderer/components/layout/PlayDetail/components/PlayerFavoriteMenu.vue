<template>
  <teleport to="#root">
    <section ref="menuRef" :class="[$style.container, { [$style.dark]: dark }]" :style="menuStyle" role="dialog" :aria-label="$t('player_favorite_title')" :aria-busy="busy" @click.stop>
      <header :class="$style.header">
        <div><strong>{{ $t('player_favorite_title') }}</strong><p :title="`${musicInfo.name} · ${musicInfo.singer}`">{{ musicInfo.name }} · {{ musicInfo.singer }}</p></div>
        <button type="button" :class="$style.close" :disabled="busy" :aria-label="$t('btn_close')" @click="close()"><span aria-hidden="true">×</span></button>
      </header>
      <QQFavoriteTarget :music-info="musicInfo" compact :disabled="localBusy" @busy="cloudBusy = $event" />
      <h3 :class="$style.label">{{ $t('favorite_local_section') }}</h3>
      <button type="button" :class="$style.local" :disabled="busy || localFavorite == null" @click="toggleLocal">
        <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ [$style.loved]: localFavorite }"><path d="M12 20s-7-4.2-7-9a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 4.8-7 9-7 9z" /></svg>
        <span><strong>{{ $t('player_favorite_local') }}</strong><small>{{ $t(localFavorite ? 'player_favorite_local_remove' : 'player_favorite_local_add') }}</small></span>
        <span v-if="localFavorite" :class="$style.check" aria-hidden="true">✓</span>
      </button>
      <p v-if="localMessage" :class="$style.message" role="status">{{ $t(localMessage) }}</p>
      <button type="button" :class="$style.more" :disabled="busy" @click="$emit('more')">{{ $t('player_favorite_more') }} <span aria-hidden="true">›</span></button>
    </section>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from '@common/utils/vueTools'
import { checkListExistMusic, addListMusics, removeListMusics } from '@renderer/store/list/action'
import { loveList } from '@renderer/store/list/state'
import QQFavoriteTarget from '@renderer/components/common/QQFavoriteTarget.vue'

const props = defineProps({ dark: Boolean, anchor: { type: Object, default: null }, musicInfo: { type: Object, required: true } })
const emit = defineEmits(['close', 'more'])
const menuRef = ref(null)
const localFavorite = ref(null)
const localBusy = ref(false)
const cloudBusy = ref(false)
const localMessage = ref('')
const busy = computed(() => localBusy.value || cloudBusy.value)
const viewport = ref({ width: window.innerWidth, height: window.innerHeight })
const menuStyle = computed(() => {
  const width = Math.min(350, Math.max(1, viewport.value.width - 24))
  const bottom = Math.max(12, Math.min(viewport.value.height - (props.anchor?.y ?? viewport.value.height - 84) + 10, viewport.value.height - 180))
  return {
    width: `${width}px`,
    left: `${Math.max(12, Math.min((props.anchor?.x ?? viewport.value.width / 2) - width / 2, viewport.value.width - width - 12))}px`,
    bottom: `${bottom}px`,
    maxHeight: `${Math.max(0, viewport.value.height - bottom - 12)}px`,
  }
})
const close = (restoreFocus = true) => { if (!busy.value) emit('close', restoreFocus) }
const toggleLocal = async() => {
  if (busy.value || localFavorite.value == null) return
  localBusy.value = true
  localMessage.value = ''
  try {
    if (localFavorite.value) await removeListMusics({ listId: loveList.id, ids: [props.musicInfo.id] })
    else await addListMusics(loveList.id, [props.musicInfo])
    localFavorite.value = !localFavorite.value
    localMessage.value = localFavorite.value ? 'player_favorite_local_added' : 'player_favorite_local_removed'
  } catch { localMessage.value = 'list_add__action_failed' } finally { localBusy.value = false }
}
const handleOutside = event => { if (!menuRef.value?.contains(event.target)) close(false) }
const handleKeydown = event => {
  if (event.key == 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
}
const handleResize = () => { viewport.value = { width: window.innerWidth, height: window.innerHeight } }
onMounted(async() => {
  document.addEventListener('click', handleOutside)
  document.addEventListener('keydown', handleKeydown, true)
  window.addEventListener('resize', handleResize)
  try { localFavorite.value = await checkListExistMusic(loveList.id, props.musicInfo.id) } catch { localMessage.value = 'list_add__action_failed' }
  await nextTick()
  menuRef.value?.querySelector('button:not(:disabled)')?.focus()
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutside)
  document.removeEventListener('keydown', handleKeydown, true)
  window.removeEventListener('resize', handleResize)
})
defineExpose({ busy })
</script>

<style lang="less" module>
.container { position: fixed; z-index: 80; box-sizing: border-box; max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); overflow-y: auto; overscroll-behavior: contain; padding: 14px; border: 1px solid rgb(from var(--color-font) r g b / .11); border-radius: 18px; color: var(--color-font); background: rgb(from var(--color-content-background) r g b / .96); box-shadow: 0 18px 50px rgba(20,28,32,.2), inset 0 1px 0 rgba(255,255,255,.65); backdrop-filter: blur(24px) saturate(1.18); animation: popIn .16s ease-out; }
.dark { color: rgba(255,255,255,.94); background: rgba(24,29,32,.96); border-color: rgba(255,255,255,.12); box-shadow: 0 22px 54px rgba(0,0,0,.42); }
.label { margin: 16px 0 10px; font-size: 11px; font-weight: 600; opacity: .6; }
.header { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 12px; }
.header > div { flex: 1; min-width: 0; }
.header strong { font-size: 14px; }
.header p { margin: 6px 0 0; font-size: 11px; opacity: .6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.container button { color: inherit; cursor: pointer; &:disabled { opacity: .45; cursor: default; } &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; } }
.close { flex: none; width: 26px; height: 26px; border: 0; border-radius: 8px; background: rgb(from currentColor r g b / .06); font-size: 21px; line-height: 1; }
.local { display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 12px; margin-bottom: 10px; border: 1px solid rgb(from currentColor r g b / .1); border-radius: 12px; background: rgb(from currentColor r g b / .035); text-align: left; &:hover { background: rgb(from currentColor r g b / .08); } }
.local svg { width: 30px; height: 30px; fill: none; stroke: currentColor; stroke-width: 1.6; flex: none; }
.local .loved { color: #f65b84; fill: currentColor; }
.local > span { display: flex; flex-direction: column; gap: 5px; }
.local strong { font-size: 13px; }
.local small { font-size: 11px; opacity: .6; }
.local .check { margin-left: auto; font-size: 17px; }
.message { font-size: 11px; line-height: 1.5; margin: 0 4px 10px; opacity: .65; }
.more { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 10px; padding: 10px 6px 0; border: 0; background: transparent; font-size: 12px; }
.more span { font-size: 20px; line-height: 1; opacity: .5; }
@keyframes popIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .container { animation: none; } }
</style>
