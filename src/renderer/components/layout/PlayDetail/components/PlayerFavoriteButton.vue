<template>
  <div ref="control" :class="$style.control">
    <button type="button" class="q-player-tool" :class="{ [$style.loved]: loved }" :aria-label="$t('favorite_button_hint')" :aria-pressed="loved" :aria-busy="busy" :disabled="!currentMusicInfo || busy" @click.stop="toggle" @contextmenu.stop.prevent="showMenu" @keydown.shift.f10.stop.prevent="showMenu" @keydown.context-menu.stop.prevent="showMenu">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5s-8.5-5.1-8.5-10.1A4.8 4.8 0 0 1 12 6.5a4.8 4.8 0 0 1 8.5 2.9c0 5-8.5 10.1-8.5 10.1Z" /></svg>
    </button>
    <button type="button" :class="$style.menuButton" :aria-label="$t('favorite_choose_playlist')" :aria-expanded="menuVisible" aria-haspopup="dialog" :disabled="!currentMusicInfo" @click.stop="showMenu" @keydown.down.stop.prevent="showMenu">
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
.control { position: relative; flex: none; width: var(--q-footer-tool-size); height: var(--q-footer-tool-size); }
.loved { --q-footer-tool-accent: #e35278; }
.loved svg { animation: q-heart-pop .32s cubic-bezier(.34, 1.56, .64, 1); }
.loved svg path { fill: currentColor; }
@keyframes q-heart-pop {
  0% { transform: scale(.78); }
  50% { transform: scale(1.22); }
  100% { transform: scale(1); }
}
.menuButton {
  position: absolute;
  right: -1px;
  bottom: -1px;
  display: grid;
  place-items: center;
  width: 12px;
  height: 12px;
  padding: 0;
  border: none;
  border-radius: 4px;
  color: var(--q-footer-tool-ink);
  background: transparent;
  cursor: pointer;
}
.menuButton svg { width: 6px; height: 4px; fill: currentColor; transition: transform .18s ease; }
.menuButton[aria-expanded='true'] svg { transform: rotate(180deg); }
.menuButton:enabled:hover, .menuButton[aria-expanded='true'] { color: var(--q-footer-tool-accent); background: var(--q-footer-tool-hover); }
.menuButton:disabled { opacity: .4; cursor: default; }
@media (prefers-reduced-motion: reduce) { .loved svg, .menuButton svg { transition: none; animation: none; } }
</style>
