<template>
  <section :class="$style.page">
    <header :class="$style.header">
      <h2>{{ $t('play_history_title') }} <small>{{ entries.length }}</small></h2>
      <base-btn :class="$style.playAll" :disabled="!entries.length || busy || loading" @click="playAll"><svg-icon name="play" />{{ $t('list__play_all') }}</base-btn>
      <base-btn :disabled="!entries.length || busy || loading" @click="clear">{{ $t('play_history_clear') }}</base-btn>
    </header>
    <div v-if="entries.length" :class="$style.order" role="group" :aria-label="$t('play_history_title')">
      <button type="button" :aria-pressed="!ranked" @click="ranked = false">{{ $t('play_history_recent') }}</button>
      <button type="button" :aria-pressed="ranked" @click="ranked = true">{{ $t('play_history_rank') }}</button>
    </div>
    <div v-if="error" :class="$style.error" role="alert"><span>{{ error }}</span><base-btn v-if="!entries.length" min :disabled="loading" @click="load">{{ $t('search__retry') }}</base-btn></div>
    <base-virtualized-list v-if="entries.length" :key="Number(ranked)" :list="rows" :item-height="64" key-name="key" container-class="scroll" :class="$style.list">
      <template #default="{ item, index }: { item: HistoryRow, index: number }">
        <div :class="$style.row">
          <span v-if="ranked" :class="$style.rank">{{ index + 1 }}</span>
          <button type="button" :class="$style.track" :disabled="busy" @click="playAt(index)">
            <TrackArtwork :music="item.track" :class="$style.cover">
              <source-icon v-if="item.track.source != 'local'" :source="item.track.source" :size="22" />
              <svg-icon v-else name="music" />
            </TrackArtwork>
            <span :class="$style.trackCopy"><strong>{{ item.track.name }}</strong><span>{{ item.track.singer }} · {{ $t(item.track.source == 'local' ? 'local_import_title' : `source_${item.track.source}`) }}</span></span>
          </button>
          <div v-if="ranked" :class="$style.count">
            <span>{{ $t('play_history_count', { count: item.playCount }) }}</span>
            <div :class="$style.meter" aria-hidden="true"><i :style="{ width: (item.playCount / rows[0].playCount) * 100 + '%' }" /></div>
          </div>
          <time v-else :datetime="new Date(item.playedAt).toISOString()" :title="new Date(item.playedAt).toLocaleString()"><span>{{ new Date(item.playedAt).toLocaleDateString() }}</span><span>{{ new Date(item.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span></time>
          <button type="button" :class="$style.remove" :aria-label="$t('play_history_remove', { name: item.track.name })" :disabled="busy" @click="remove(item.track)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg></button>
        </div>
      </template>
    </base-virtualized-list>
    <div v-else-if="loading || !error" :class="$style.empty" role="status" :aria-busy="loading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></svg><p>{{ $t(loading ? 'list__loading' : 'play_history_empty') }}</p></div>
  </section>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { playHistory } from '@renderer/core/playHistory'
import { playFromPage, playAllFromPage } from '@renderer/core/player/selection'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@root/lang'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'
import TrackArtwork from '@renderer/components/common/TrackArtwork.vue'
const t = useI18n()
interface HistoryRow { track: LX.Music.MusicInfo, playedAt: number, playCount: number, key: string }
const entries = ref(playHistory.snapshot().entries)
const ranked = ref(false)
const rows = computed(() => {
  const list = entries.value.map(entry => ({ ...entry, key: `${entry.track.source}:${entry.track.id}` }))
  return ranked.value ? list.sort((a, b) => b.playCount - a.playCount || b.playedAt - a.playedAt) : list
})
const error = ref('')
const busy = ref(false)
const loading = ref(!entries.value.length)
const unsubscribe = playHistory.subscribe(() => { entries.value = playHistory.snapshot().entries })
onBeforeUnmount(unsubscribe)
const load = async() => {
  loading.value = true
  error.value = ''
  try { await playHistory.load() } catch { error.value = t('play_history_failed') } finally { loading.value = false }
}
onMounted(() => { void load() })
const run = async(action: () => Promise<void>) => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try { await action() } catch { error.value = t('play_history_failed') } finally { busy.value = false }
}
const playAt = async(index: number) => run(async() => playFromPage('play-history', rows.value.map(item => item.track), index))
const playAll = async() => run(async() => playAllFromPage('play-history', rows.value.map(item => item.track)))
const remove = async(track: LX.Music.MusicInfo) => run(async() => playHistory.remove(track))
const clear = async() => run(async() => { if (await dialog.confirm({ message: t('play_history_clear_confirm') })) await playHistory.clear() })
</script>
<style module lang="less">
@import '@renderer/assets/styles/layout.less';
.page { height: 100%; display: flex; flex-direction: column; box-sizing: border-box; padding: 20px 24px calc(@height-player + 20px); }
.header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; flex-wrap: wrap; }
.header h2 { flex: 1; font-size: 21px; display: flex; align-items: center; gap: 10px; }
.header small { min-width: 20px; padding: 4px 8px; border-radius: 8px; font-size: 12px; font-weight: 500; text-align: center; color: var(--color-font-label); background: var(--q-surface-strong); }
.playAll { display: flex; align-items: center; gap: 6px; svg { width: 14px; height: 14px; } }
.error { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 12px 16px; margin-bottom: 12px; border: 1px solid var(--q-outline); border-radius: 12px; line-height: 1.5; }
.list { flex: 1; min-height: 0; }
.order {
  display: flex;
  align-self: flex-start;
  gap: 3px;
  padding: 3px;
  margin-bottom: 10px;
  border: 1px solid var(--q-outline);
  border-radius: 10px;
  button {
    border: 0;
    border-radius: 7px;
    padding: 5px 12px;
    color: var(--color-font-label);
    background: transparent;
    font: inherit;
    cursor: pointer;
    &[aria-pressed=true] { background: var(--color-primary-background-active); color: var(--color-font); }
    &:focus-visible { outline: 2px solid var(--color-primary); }
  }
}
.rank { min-width: 2ch; color: var(--color-font-label); text-align: right; font-variant-numeric: tabular-nums; }
.count { width: clamp(64px, 10vw, 130px); display: grid; gap: 5px; text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; }
.meter { height: 4px; overflow: hidden; border-radius: 4px; background: var(--q-outline); }
.meter i { display: block; height: 100%; min-width: 1px; border-radius: inherit; background: var(--color-primary); }
.row { display: flex; align-items: center; box-sizing: border-box; height: 64px; gap: 12px; padding: 0 8px; border-radius: 12px; transition: background-color .15s ease; &:hover, &:focus-within { background: var(--color-primary-background-hover); } }
.row button { color: inherit; border: 0; background: transparent; cursor: pointer; border-radius: 10px; &:disabled { opacity: .4; cursor: default; } &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; } }
.track { flex: 1; min-width: 0; align-self: stretch; padding: 6px 8px; text-align: left; display: flex; align-items: center; gap: 12px; }
.cover { --track-artwork-size: 36px; --track-artwork-radius: 10px; svg { width: 22px; height: 22px; } }
.trackCopy { min-width: 0; display: flex; flex-direction: column; gap: 5px; strong, > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } strong { font-weight: 600; } > span { font-size: 12px; color: var(--color-font-label); } }
.row time { flex: none; display: flex; flex-direction: column; gap: 4px; text-align: right; font-size: 11px; font-variant-numeric: tabular-nums; color: var(--color-font-label); }
.remove { flex: none; width: 32px; height: 32px; padding: 7px; opacity: .55; transition: opacity .15s ease, background-color .15s ease; svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; } &:hover, &:focus-visible { opacity: 1; background: var(--color-primary-background-active); } }
.empty { flex: 1; min-height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; color: var(--color-font-label); text-align: center; line-height: 1.6; svg { width: 36px; height: 36px; opacity: .5; } }
</style>
