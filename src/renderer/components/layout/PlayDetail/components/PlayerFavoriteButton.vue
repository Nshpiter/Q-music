<template>
  <div ref="control" :class="[$style.control, { [$style.dark]: dark }]">
    <button type="button" :class="[$style.button, $style.heart, { [$style.loved]: loved }]" :aria-label="$t('favorite_button_hint')" :aria-pressed="loved" :aria-busy="busy" :disabled="!currentMusicInfo || busy" @click.stop="toggle" @contextmenu.stop.prevent="showMenu" @keydown.shift.f10.stop.prevent="showMenu" @keydown.context-menu.stop.prevent="showMenu">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-8-4.8-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.2-8 10-8 10z" /></svg>
    </button>
    <button type="button" :class="[$style.button, $style.menuButton, { [$style.active]: menuVisible }]" :aria-label="$t('favorite_choose_playlist')" :aria-expanded="menuVisible" aria-haspopup="dialog" :disabled="!currentMusicInfo" @click.stop="showMenu" @keydown.down.stop.prevent="showMenu">
      <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1h8L5 5z" /></svg>
    </button>
  </div>
  <PlayerFavoriteMenu v-if="menuVisible" ref="menu" :music-info="selectedMusicInfo" :dark="dark" :anchor="anchor" @close="closeMenu" @more="showLists" />
  <common-list-add-modal v-model:show="listsVisible" :music-info="selectedMusicInfo" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { playMusicInfo } from '@renderer/store/player/state'
import { appSetting } from '@renderer/store/setting'
import { checkListExistMusic } from '@renderer/store/list/action'
import { getFavoriteListId, toggleLocalFavorite } from '@renderer/core/localFavorite'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@renderer/plugins/i18n'
import PlayerFavoriteMenu from './PlayerFavoriteMenu.vue'

defineProps({ dark: Boolean })
const t = useI18n()
const loved = ref(false)
const control = ref(null)
const busy = ref(false)
const menu = ref(null)
const menuVisible = ref(false)
const listsVisible = ref(false)
const selectedMusicInfo = ref(null)
const anchor = ref(null)
let trigger = null
let checkId = 0
const currentMusicInfo = computed(() => {
  const info = playMusicInfo.musicInfo
  return info && ('progress' in info ? info.metadata.musicInfo : info)
})
const refresh = async() => {
  const track = currentMusicInfo.value
  const requestId = ++checkId
  if (!track) { loved.value = false; return }
  const value = await checkListExistMusic(getFavoriteListId(), track.id).catch(() => false)
  if (requestId == checkId) loved.value = value
}
const toggle = async() => {
  if (!currentMusicInfo.value || busy.value) return
  busy.value = true
  try { await toggleLocalFavorite(currentMusicInfo.value); await refresh() } catch { void dialog({ message: t('favorite_default_failed') }) } finally { busy.value = false }
}
const closeMenu = (restoreFocus = true) => {
  if (menu.value?.busy) return
  menuVisible.value = false
  if (restoreFocus) trigger?.focus()
}
const showMenu = event => {
  if (!currentMusicInfo.value) return
  if (menuVisible.value) { closeMenu(); return }
  trigger = event.currentTarget
  const rect = control.value.getBoundingClientRect()
  anchor.value = { x: rect.left + rect.width / 2, y: rect.top }
  // 固定打开菜单时的歌曲，播放切换不会改变待收藏对象。
  selectedMusicInfo.value = currentMusicInfo.value
  menuVisible.value = true
}
const showLists = () => {
  closeMenu()
  listsVisible.value = true
}
const handleListUpdate = ids => { if (ids.includes(getFavoriteListId())) void refresh() }
watch([() => currentMusicInfo.value?.source, () => currentMusicInfo.value?.id, () => appSetting['list.favoriteTargetId']], () => { loved.value = false; void refresh() }, { immediate: true })
onMounted(() => { window.app_event.on('myListUpdate', handleListUpdate) })
onBeforeUnmount(() => { ++checkId; window.app_event.off('myListUpdate', handleListUpdate) })
</script>

<style module lang="less">
.control { position: relative; flex: none; width: 34px; height: 32px; color: var(--color-font-label); }
.button { display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 8px; background: transparent; color: inherit; cursor: pointer; transition: color .18s ease, background-color .18s ease, transform .18s ease; }
.heart { width: 32px; height: 32px; }
.heart svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; transition: fill .18s ease; }
.menuButton { position: absolute; right: 0; bottom: 0; width: 12px; height: 14px; }
.menuButton svg { width: 6px; height: 4px; fill: currentColor; transition: transform .18s ease; }
.menuButton.active svg { transform: rotate(180deg); }
.button:hover, .active { color: var(--color-font); background: var(--q-icon-btn-hover-bg); }
.button:active { transform: scale(.9); }
.button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.button:disabled { opacity: .35; cursor: default; transform: none; }
.dark { color: rgba(255,255,255,.72); }
.dark .button:hover, .dark .active { color: #fff; background: rgba(255,255,255,.12); }
.loved, .loved:hover { color: #f65b84; }
.heart.loved svg { fill: currentColor; }
@media (prefers-reduced-motion: reduce) { .button, .button svg { transition: none; } }
</style>
