<template>
  <section :class="$style.page">
    <div :class="$style.panel">
      <header :class="$style.header">
        <h2>{{ $t('play_history_title') }} <small>{{ entries.length }}</small></h2>
        <div v-if="entries.length" ref="orderRef" :class="$style.order" role="group" :aria-label="$t('play_history_title')">
          <span
            v-show="orderIndicator.width > 0"
            :class="[$style.orderIndicator, { [$style.orderReady]: orderReady }]"
            :style="{ width: `${orderIndicator.width}px`, transform: `translateX(${orderIndicator.left}px)` }"
            aria-hidden="true"
          />
          <button type="button" :aria-pressed="!ranked" @click="ranked = false">{{ $t('play_history_recent') }}</button>
          <button type="button" :aria-pressed="ranked" @click="ranked = true">{{ $t('play_history_rank') }}</button>
        </div>
        <div :class="$style.headerActions">
          <button v-if="entries.length || searching" ref="searchButton" type="button" :class="$style.searchButton" :aria-label="$t('play_history_search')" :title="$t('play_history_search')" :aria-expanded="searching" @click="toggleSearch"><svg-icon name="search-2" /></button>
          <base-btn :class="$style.playAll" :disabled="!rows.length || busy || loading" @click="playAll"><svg-icon name="play" />{{ $t(hasFilter ? 'play_history_play_matches' : 'list__play_all') }}</base-btn>
          <base-btn v-if="!searching" outline :disabled="!entries.length || busy || loading" @click="clear">{{ $t('play_history_clear') }}</base-btn>
        </div>
      </header>
      <transition
        :enter-active-class="$style.searchEnterActive"
        :leave-active-class="$style.searchLeaveActive"
        :enter-from-class="$style.searchHidden"
        :leave-to-class="$style.searchHidden"
      >
        <div v-if="searching" :class="$style.searchBar">
          <div :class="$style.searchFieldWrap">
            <svg-icon name="search-2" :class="$style.searchFieldIcon" />
            <input ref="searchInput" v-model="query" type="search" :aria-label="$t('play_history_search')" :placeholder="$t('play_queue__search_hint')" @keydown.esc.stop.prevent="!$event.isComposing && toggleSearch()">
          </div>
          <span :class="$style.searchCount" role="status">{{ $t('play_queue__songs', { num: rows.length }) }}</span>
        </div>
      </transition>
      <div v-if="error" :class="$style.error" role="alert"><span>{{ error }}</span><base-btn v-if="!entries.length" min :disabled="loading" @click="load">{{ $t('search__retry') }}</base-btn></div>
      <base-virtualized-list v-if="rows.length" :key="Number(ranked)" ref="listRef" :list="rows" :item-height="listItemHeight" key-name="key" container-class="scroll" :content-class="$style.historyRows" :class="$style.list">
        <template #default="{ item }: { item: HistoryRow }">
          <div
            :class="[$style.row, { [$style.playing]: isCurrentTrack(item.track), [$style.selected]: menuTrackKey == item.key }]"
            @contextmenu.prevent="openMenu($event, item.track)"
          >
            <span v-if="isCurrentTrack(item.track)" class="list-eq" :class="{ [$style.paused]: !isPlay }" aria-hidden="true"><i /><i /><i /></span>
            <span v-else-if="ranked" :class="[$style.rank, { [$style.rankTop]: item.rank <= 3 }]">{{ item.rank }}</span>
            <button type="button" :class="$style.track" :disabled="busy" @click="playAt(item.key)">
              <TrackArtwork :music="item.track" :class="$style.cover">
                <source-icon v-if="item.track.source != 'local'" :source="item.track.source" :size="20" />
                <svg-icon v-else name="music" />
              </TrackArtwork>
              <span :class="$style.trackCopy"><strong>{{ item.track.name }}</strong><span>{{ item.track.singer }} · {{ $t(item.track.source == 'local' ? 'local_import_title' : `source_${item.track.source}`) }}</span></span>
            </button>
            <div v-if="ranked" :class="$style.count">
              <span>{{ $t('play_history_count', { count: item.playCount }) }}</span>
              <div :class="$style.meter" aria-hidden="true"><i :style="{ width: (item.playCount / sortedRows[0].playCount) * 100 + '%' }" /></div>
            </div>
            <time v-else :datetime="new Date(item.playedAt).toISOString()" :title="new Date(item.playedAt).toLocaleString()"><span>{{ new Date(item.playedAt).toLocaleDateString() }}</span><span>{{ new Date(item.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span></time>
            <div :class="$style.rowActions">
              <button type="button" :class="$style.rowBtn" :aria-label="$t('more')" :disabled="busy" @click.stop="openMenu($event, item.track)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>
              </button>
              <button type="button" :class="[$style.rowBtn, $style.remove]" :aria-label="$t('play_history_remove', { name: item.track.name })" :disabled="busy" @click.stop="remove(item.track)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
            </div>
          </div>
        </template>
      </base-virtualized-list>
      <div v-else-if="loading || !error" :class="$style.empty" role="status" :aria-busy="loading">
        <div :class="$style.emptyIcon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></svg>
        </div>
        <p>{{ $t(loading ? 'list__loading' : hasFilter ? 'play_history_no_matches' : 'play_history_empty') }}</p>
      </div>
    </div>
    <common-list-add-modal v-model:show="isShowListAdd" :music-info="selectedAddMusicInfo" teleport="#view" />
    <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  </section>
</template>
<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { LIST_IDS } from '@common/constants'
import { clipboardWriteText, openUrl } from '@common/utils/electron'
import { playHistory } from '@renderer/core/playHistory'
import { type HistoryEntry } from '@common/utils/playHistory'
import { matchesTrackSearch, trackSearchTerms } from '@common/utils/trackSearch'
import { playFromPage, playAllFromPage } from '@renderer/core/player/selection'
import { addTempPlayList } from '@renderer/store/player/action'
import { isPlay, playMusicInfo } from '@renderer/store/player/state'
import { addDislikeInfo, hasDislike } from '@renderer/core/dislikeList'
import { playNext } from '@renderer/core/player'
import { isFullscreen } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import { formatMusicName, getFontSizeWithScreen, toOldMusicInfo } from '@renderer/utils'
import musicSdk from '@renderer/utils/musicSdk'
import { buildSongMenus } from '@renderer/utils/songMenu'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@root/lang'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'
import TrackArtwork from '@renderer/components/common/TrackArtwork.vue'
const t = useI18n()
const router = useRouter()
const listItemHeight = computed(() => Math.max(50, Math.ceil((isFullscreen.value ? getFontSizeWithScreen() : appSetting['common.fontSize']) * 3.15)))
const entries = ref(playHistory.snapshot().entries)
const ranked = ref(false)
type HistoryRow = HistoryEntry<LX.Music.MusicInfo> & { key: string, rank: number }
const searching = ref(false)
const query = ref('')
const searchButton = ref<HTMLButtonElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const listRef = ref<{ scrollTo: (position: number) => void, getScrollTop: () => number } | null>(null)
let previousScroll = 0
const toggleSearch = async() => {
  if (searching.value) {
    searching.value = false
    query.value = ''
    await nextTick()
    listRef.value?.scrollTo(previousScroll)
    searchButton.value?.focus()
  } else {
    previousScroll = listRef.value?.getScrollTop() ?? 0
    searching.value = true
    await nextTick()
    searchInput.value?.focus()
  }
}
const orderRef = ref<HTMLElement | null>(null)
const orderIndicator = reactive({ left: 0, width: 0 })
const orderReady = ref(false)
const isCurrentTrack = (track: LX.Music.MusicInfo) => {
  const current = playMusicInfo.musicInfo
  const song = current && ('progress' in current ? current.metadata.musicInfo : current)
  return song?.id == track.id && song?.source == track.source
}
const updateOrderIndicator = () => {
  const root = orderRef.value
  const active = root?.querySelector<HTMLElement>('button[aria-pressed="true"]')
  if (!root || !active) { orderIndicator.width = 0; return }
  const rootRect = root.getBoundingClientRect()
  const activeRect = active.getBoundingClientRect()
  orderIndicator.left = activeRect.left - rootRect.left
  orderIndicator.width = activeRect.width
}
watch([ranked, () => entries.value.length], () => { void nextTick(updateOrderIndicator) }, { flush: 'post' })
const sortedRows = computed<HistoryRow[]>(() => {
  const list = ranked.value ? [...entries.value].sort((a, b) => b.playCount - a.playCount || b.playedAt - a.playedAt) : entries.value
  return list.map((entry, index) => ({ ...entry, key: `${entry.track.source}:${entry.track.id}`, rank: index + 1 }))
})
const terms = computed(() => trackSearchTerms(query.value))
const hasFilter = computed(() => terms.value.length > 0)
const rows = computed(() => hasFilter.value ? sortedRows.value.filter(row => matchesTrackSearch(row.track, terms.value)) : sortedRows.value)
watch(query, () => { if (searching.value) listRef.value?.scrollTo(0) }, { flush: 'post' })
watch(ranked, () => { previousScroll = 0 })
const error = ref('')
const busy = ref(false)
const loading = ref(!entries.value.length)
const unsubscribe = playHistory.subscribe(() => { entries.value = playHistory.snapshot().entries })
let resizeObserver: ResizeObserver | undefined
let readyFrame = 0
onBeforeUnmount(() => {
  unsubscribe()
  resizeObserver?.disconnect()
  window.cancelAnimationFrame(readyFrame)
})
const load = async() => {
  loading.value = true
  error.value = ''
  try { await playHistory.load() } catch { error.value = t('play_history_failed') } finally { loading.value = false }
}
onMounted(() => {
  void load()
  updateOrderIndicator()
  readyFrame = window.requestAnimationFrame(() => { orderReady.value = true })
  if (typeof ResizeObserver != 'undefined') {
    resizeObserver = new ResizeObserver(updateOrderIndicator)
    if (orderRef.value) resizeObserver.observe(orderRef.value)
  }
})
watch(orderRef, el => {
  resizeObserver?.disconnect()
  if (el && resizeObserver) resizeObserver.observe(el)
  void nextTick(updateOrderIndicator)
})
const run = async(action: () => Promise<void>) => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try { await action() } catch { error.value = t('play_history_failed') } finally { busy.value = false }
}
const playAt = async(key: string) => run(async() => {
  const list = rows.value
  const index = list.findIndex(row => row.key == key)
  if (index >= 0) await playFromPage('play-history', list.map(item => item.track), index)
})
const playAll = async() => run(async() => playAllFromPage('play-history', rows.value.map(item => item.track)))
const remove = async(track: LX.Music.MusicInfo) => run(async() => playHistory.remove(track))
const clear = async() => run(async() => { if (await dialog.confirm({ message: t('play_history_clear_confirm') })) await playHistory.clear() })
const isShowListAdd = ref(false)
const selectedAddMusicInfo = ref<LX.Music.MusicInfo | null>(null)
const isShowItemMenu = ref(false)
const menuTrack = ref<LX.Music.MusicInfo | null>(null)
const menuLocation = reactive({ x: 0, y: 0 })
const menuTrackKey = computed(() => isShowItemMenu.value && menuTrack.value ? `${menuTrack.value.source}:${menuTrack.value.id}` : '')
const menus = computed(() => {
  const track = menuTrack.value
  return buildSongMenus({
    t,
    hasSelection: false,
    control: {
      play: true,
      playNext: true,
      playLater: true,
      addTo: true,
      download: false,
      copyName: true,
      search: true,
      sourceDetail: !!track && track.source != 'local' && !!musicSdk[track.source]?.getMusicDetailPageUrl,
      dislike: !!track && !hasDislike(track),
      remove: true,
    },
    includeDownload: false,
    includeCopyName: true,
    includeRemove: true,
  })
})
const openMenu = (event: MouseEvent, track: LX.Music.MusicInfo) => {
  menuTrack.value = track
  if (event.pageX || event.pageY) {
    menuLocation.x = event.pageX
    menuLocation.y = event.pageY
  } else if (event.currentTarget instanceof Element) {
    const rect = event.currentTarget.getBoundingClientRect()
    menuLocation.x = rect.right
    menuLocation.y = rect.bottom
  }
  void nextTick(() => { isShowItemMenu.value = true })
}
const handleMenuClick = async(action: { action?: string } | null) => {
  const track = menuTrack.value
  isShowItemMenu.value = false
  if (!action || !track) return
  switch (action.action) {
    case 'play':
      await playAt(`${track.source}:${track.id}`)
      break
    case 'playNext':
      addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo: track, isTop: true }])
      break
    case 'playLater':
      addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo: track }])
      break
    case 'addTo':
      selectedAddMusicInfo.value = track
      void nextTick(() => { isShowListAdd.value = true })
      break
    case 'copyName':
      clipboardWriteText(formatMusicName(appSetting['download.fileName'], track.name, track.singer))
      break
    case 'search':
      void router.push({ path: '/search', query: { text: `${track.name} ${track.singer}` } })
      break
    case 'sourceDetail':
      if (track.source != 'local') {
        const url = musicSdk[track.source]?.getMusicDetailPageUrl?.(toOldMusicInfo(track))
        if (url) void openUrl(url)
      }
      break
    case 'dislike': {
      const confirm = await dialog.confirm({
        message: track.singer ? t('lists__dislike_music_singer_tip', { name: track.name, singer: track.singer }) : t('lists__dislike_music_tip', { name: track.name }),
        cancelButtonText: t('cancel_button_text_2'),
        confirmButtonText: t('confirm_button_text'),
      })
      if (!confirm) return
      await addDislikeInfo([{ name: track.name, singer: track.singer }])
      if (hasDislike(playMusicInfo.musicInfo)) void playNext(true)
      break
    }
    case 'remove':
      await remove(track)
      break
  }
}
</script>
<style module lang="less">
@import '@renderer/assets/styles/layout.less';
.page { height: 100%; display: flex; flex-direction: column; box-sizing: border-box; padding-block: 14px calc(@height-player + 16px); }
.panel {
  --history-inset: max(20px, calc((100% - 1240px) / 2));
  position: relative;
  isolation: isolate;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.panel::before {
  content: '';
  position: absolute;
  inset: 0 var(--history-inset);
  pointer-events: none;
  z-index: -1;
  border-radius: 20px;
  border: 1px solid rgb(from var(--color-font) r g b / .08);
  background: rgb(from var(--color-content-background) r g b / .5);
  box-shadow: 0 18px 44px rgba(34, 45, 48, .08), inset 0 1px 0 rgba(255, 255, 255, .56);
  backdrop-filter: blur(16px) saturate(1.1);
}
.panel > :not(.list) { margin-inline: var(--history-inset); }
.header { display: flex; align-items: center; gap: 12px; padding: 16px 20px 14px; flex-wrap: wrap; border-bottom: 1px solid rgb(from var(--color-font) r g b / .07); }
.header h2 { flex: 1; min-width: 140px; font-size: 20px; font-weight: 680; display: flex; align-items: center; gap: 10px; }
.header small { min-width: 22px; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: center; color: var(--color-primary-dark-200); background: var(--color-primary-alpha-900); }
.headerActions { display: flex; align-items: center; gap: 8px; }
.searchButton {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--color-font);
  cursor: pointer;
  transition: background-color .16s ease, color .16s ease, transform .14s ease;
  svg { width: 16px; height: 16px; }
  &:hover, &[aria-expanded=true] { background: var(--color-primary-background-hover); color: var(--color-primary); }
  &:active { transform: scale(.94); }
  &:focus-visible { outline: 2px solid var(--color-primary); }
}
.searchBar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid rgb(from var(--color-font) r g b / .07);
  background: rgb(from var(--color-main-background) r g b / .32);
}
.searchFieldWrap {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  input {
    flex: 1;
    min-width: 0;
    height: 34px;
    padding: 0 12px 0 34px;
    border: 1px solid var(--q-outline);
    border-radius: 11px;
    background: var(--q-surface-soft);
    color: var(--color-font);
    font: inherit;
    font-size: 13px;
    transition: border-color @transition-fast, background-color @transition-fast, box-shadow @transition-fast;
    &:focus {
      outline: none;
      border-color: var(--color-primary);
      background: var(--q-surface-strong);
      box-shadow: 0 0 0 3px var(--color-primary-alpha-900);
    }
  }
}
.searchFieldIcon {
  position: absolute;
  left: 11px;
  width: 14px;
  height: 14px;
  color: var(--color-font-label);
  pointer-events: none;
}
.searchCount {
  flex: none;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-primary-alpha-900);
  color: var(--color-primary-dark-200);
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.searchEnterActive {
  transition: opacity .2s ease, transform .24s cubic-bezier(.22, 1, .36, 1);
}
.searchLeaveActive {
  transition: opacity .14s ease, transform .16s cubic-bezier(.4, 0, 1, 1);
}
.searchHidden {
  opacity: 0;
  transform: translateY(-6px);
}
.playAll { display: flex; align-items: center; gap: 6px; svg { width: 14px; height: 14px; } }
.error { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 12px 16px; margin: 12px 16px 0; border: 1px solid var(--q-outline); border-radius: 12px; line-height: 1.5; }
.list { flex: 1; min-height: 0; padding-block: 6px; box-sizing: border-box; }
.historyRows { position: relative; margin-inline: calc(var(--history-inset) + 8px); }
.order {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 11px;
  background: var(--q-surface-soft);
  box-shadow: inset 0 0 0 1px var(--q-border);
  button {
    position: relative;
    z-index: 1;
    border: 0;
    border-radius: 8px;
    padding: 5px 13px;
    color: var(--color-font-label);
    background: transparent;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: color .18s ease, transform .14s ease;
    &:hover { color: var(--color-font); }
    &:active { transform: scale(.96); }
    &[aria-pressed=true] { color: var(--color-primary-dark-200); font-weight: 620; }
    &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  }
}
.orderIndicator {
  position: absolute;
  left: 0;
  top: 3px;
  bottom: 3px;
  border-radius: 8px;
  background: var(--color-content-background);
  box-shadow: 0 2px 8px rgba(24, 36, 31, .08), inset 0 0 0 1px var(--q-border);
  pointer-events: none;
}
.orderReady { transition: transform .3s cubic-bezier(.22, 1, .36, 1), width .3s cubic-bezier(.22, 1, .36, 1); }
.rank { min-width: 2.2ch; color: var(--color-font-label); text-align: right; font-variant-numeric: tabular-nums; font-size: 13px; }
.rankTop { color: var(--color-primary); font-weight: 750; }
.count { width: clamp(68px, 10vw, 132px); display: grid; gap: 5px; text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; }
.meter { height: 4px; overflow: hidden; border-radius: 4px; background: var(--q-outline); }
.meter i { display: block; height: 100%; min-width: 2px; border-radius: inherit; background: var(--color-primary); transition: width .36s cubic-bezier(.22, 1, .36, 1); }
.row {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: calc(100% - 4px);
  margin: 2px 7px;
  gap: 10px;
  padding: 0 8px;
  border-radius: 10px;
  box-shadow: inset 0 -1px 0 rgb(from var(--color-font) r g b / .05);
  transition: background-color .16s ease, box-shadow .16s ease, transform .18s cubic-bezier(.22, 1, .36, 1);
  &:hover, &:focus-within { background: rgb(from var(--color-content-background) r g b / .5); transform: translateX(2px); }
  &.selected {
    background-color: var(--color-primary-background-hover);
  }
  &.playing {
    background: var(--color-primary-alpha-900);
    box-shadow: none;
    .trackCopy strong { color: var(--color-primary-font-active); font-weight: 700; }
  }
  &.playing.selected {
    background-color: var(--color-primary-alpha-700);
  }
}
.paused i { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) { .row, .orderReady, .order button, .meter i { transition: none; &:hover, &:focus-within { transform: none; } } }
.row button { overflow: hidden; color: inherit; border: 0; background: transparent; cursor: pointer; border-radius: 8px; &:disabled { opacity: .4; cursor: default; } &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; } }
.track { flex: 1; min-width: 0; align-self: stretch; padding: 4px 6px; text-align: left; display: flex; align-items: center; gap: 10px; }
.cover { --track-artwork-size: 34px; --track-artwork-radius: 8px; svg { width: 18px; height: 18px; } }
.trackCopy { min-width: 0; display: flex; flex-direction: column; gap: 3px; strong, > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } strong { font-weight: 600; font-size: 13.5px; } > span { font-size: 11.5px; color: var(--color-font-label); } }
.row time { flex: none; display: flex; flex-direction: column; gap: 3px; text-align: right; font-size: 11px; font-variant-numeric: tabular-nums; color: var(--color-font-label); }
.rowActions { flex: none; display: inline-flex; align-items: center; gap: 3px; }
.rowBtn {
  flex: none;
  width: 28px;
  height: 28px;
  padding: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--color-font) 80%, transparent);
  transition: color .16s ease, background-color .16s ease, transform .14s ease, opacity .15s ease;
  svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; fill: none; }
  &:hover:not(:disabled), &:focus-visible:not(:disabled) { color: var(--color-font); background: var(--q-icon-btn-hover-bg); }
  &:active:not(:disabled) { background: var(--color-button-background-active); transform: scale(.92); }
}
.remove { opacity: .65; &:hover:not(:disabled), &:focus-visible:not(:disabled) { opacity: 1; } }
.empty { flex: 1; min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px; color: var(--color-font-label); text-align: center; line-height: 1.6; }
.emptyIcon { width: 58px; height: 58px; display: flex; align-items: center; justify-content: center; border-radius: 18px; color: var(--color-primary); background: rgb(from var(--color-primary) r g b / .1); box-shadow: inset 0 0 0 1px rgb(from var(--color-primary) r g b / .12); svg { width: 28px; height: 28px; } }
</style>
