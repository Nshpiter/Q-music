<template>
  <section :class="$style.page">
    <header :class="$style.header">
      <h2>{{ $t('play_history_title') }} <small>{{ entries.length }}</small></h2>
      <button type="button" :disabled="!entries.length" @click="playAll">{{ $t('list__play_all') }}</button>
      <button type="button" :disabled="!entries.length || busy" @click="clear">{{ $t('play_history_clear') }}</button>
    </header>
    <p v-if="error" role="alert">{{ error }}</p>
    <base-virtualized-list v-if="entries.length" :list="rows" :item-height="64" key-name="key" container-class="scroll" :class="$style.list">
      <template #default="{ item, index }: { item: HistoryRow, index: number }">
        <div :class="$style.row">
          <button type="button" :class="$style.track" @click="playAt(index)"><strong>{{ item.track.name }}</strong><span>{{ item.track.singer }} · {{ $t(item.track.source == 'local' ? 'local_import_title' : `source_${item.track.source}`) }}</span></button>
          <time>{{ new Date(item.playedAt).toLocaleString() }}</time>
          <button type="button" :aria-label="$t('play_history_remove', { name: item.track.name })" :disabled="busy" @click="remove(item.track)">×</button>
        </div>
      </template>
    </base-virtualized-list>
    <p v-else role="status">{{ $t('play_history_empty') }}</p>
  </section>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { playHistory } from '@renderer/core/playHistory'
import { playFromPage, playAllFromPage } from '@renderer/core/player/selection'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@root/lang'
const t = useI18n()
interface HistoryRow { track: LX.Music.MusicInfo, playedAt: number, key: string }
const entries = ref(playHistory.snapshot().entries)
const rows = computed(() => entries.value.map(entry => ({ ...entry, key: `${entry.track.source}:${entry.track.id}` })))
const error = ref('')
const busy = ref(false)
const unsubscribe = playHistory.subscribe(() => { entries.value = playHistory.snapshot().entries })
onBeforeUnmount(unsubscribe)
onMounted(() => { void playHistory.load().catch(() => { error.value = t('play_history_failed') }) })
const run = async(action: () => Promise<void>) => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try { await action() } catch { error.value = t('play_history_failed') } finally { busy.value = false }
}
const playAt = async(index: number) => run(async() => playFromPage('play-history', entries.value.map(item => item.track), index))
const playAll = async() => run(async() => playAllFromPage('play-history', entries.value.map(item => item.track)))
const remove = async(track: LX.Music.MusicInfo) => run(async() => playHistory.remove(track))
const clear = async() => run(async() => { if (await dialog.confirm({ message: t('play_history_clear_confirm') })) await playHistory.clear() })
</script>
<style module lang="less">
@import '@renderer/assets/styles/layout.less';
.page { height: 100%; display: flex; flex-direction: column; box-sizing: border-box; padding: 20px 24px calc(@height-player + 20px); }
.header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; flex-wrap: wrap; }
.header h2 { flex: 1; font-size: 21px; } .header small { font-size: 13px; opacity: .6; }
.page button, .page a { color: inherit; } .page button { border: 0; border-radius: 10px; padding: 10px 14px; background: var(--q-surface-strong); cursor: pointer; &:disabled { opacity: .4; cursor: default; } &:focus-visible { outline: 2px solid var(--color-primary); } }
.list { flex: 1; min-height: 0; } .row { display: flex; align-items: center; height: 64px; gap: 12px; padding: 0 8px; border-bottom: 1px solid var(--q-outline); }
.row .track { flex: 1; min-width: 0; text-align: left; background: transparent; display: flex; flex-direction: column; gap: 6px; } .track strong, .track span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; } .track span, .row time { font-size: 12px; opacity: .65; }
</style>
