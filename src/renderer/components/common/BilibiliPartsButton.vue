<template>
  <span :class="$style.entry" @click.stop @dblclick.stop @contextmenu.stop>
    <button type="button" :class="[$style.trigger, { [$style.playerTrigger]: player, [$style.darkTrigger]: dark }]" :aria-label="`${music.name} · ${$t('bili_parts')}`" :aria-expanded="shown" aria-haspopup="dialog" @click="open">
      <svg v-if="player" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h9M4 18h9M17 10l5 4-5 4z" /></svg>
      {{ $t('bili_parts') }}
    </button>
    <material-modal v-if="mounted" :show="shown" :heading="$t('bili_parts')" :placement="player ? 'player' : 'center'" :width="player ? '480px' : '560px'" max-width="100%" max-height="78%" bg-close @close="close" @after-leave="mounted = false">
      <div :class="$style.panel">
        <h3 :title="contents?.title || music.name">{{ contents?.title || music.name }}</h3>
        <div v-if="contents" :class="$style.tabs" role="tablist">
          <button type="button" role="tab" :aria-selected="mode == 'parts'" @click="load('parts', 1)">{{ $t('bili_video_parts') }} · {{ contents.parts.length }}</button>
          <button v-if="contents.collection" type="button" role="tab" :aria-selected="mode == 'collection'" @click="load('collection', 1)">{{ $t('bili_collection') }}</button>
        </div>
        <p v-if="mode == 'collection'">{{ contents?.collection?.name }}</p>
        <p v-else-if="contents?.parts.length == 1">{{ $t('bili_single_part') }}</p>
        <div v-if="contents && mode == 'parts'" :class="$style.findBar">
          <input :value="query" type="search" :placeholder="$t('bili_search_parts')" :aria-label="$t('bili_search_parts')" @input="filterParts($event.target.value)">
          <button v-if="currentPartIndex >= 0" type="button" @click="locateCurrent">{{ $t('bili_locate_current') }}</button>
        </div>
        <div v-if="loading" :class="$style.status" role="status">{{ $t('bili_loading') }}</div>
        <div v-else-if="error" :class="$style.status" role="alert"><p>{{ $t('bili_load_failed') }}</p><base-btn min @click="contents ? load(mode, page) : open()">{{ $t('search__retry') }}</base-btn></div>
        <div v-else ref="rows" :class="[$style.rows, 'scroll']">
          <p v-if="!list.length" :class="$style.status">{{ $t('bili_no_parts') }}</p>
          <button v-for="(item, index) in list" :key="item.songmid" type="button" :class="[$style.row, { [$style.currentRow]: isCurrent(item) }]" :aria-current="isCurrent(item) ? 'true' : undefined" :aria-label="`${$t('bili_play')} ${item.name}`" @click="play(index)">
            <span :class="$style.number">{{ mode == 'parts' ? contents.parts.indexOf(item) + 1 : (page - 1) * limit + index + 1 }}</span>
            <span :class="$style.track"><span :class="$style.name">{{ item.name }}</span><span v-if="isCurrent(item)" :class="$style.currentLabel">{{ $t(isPlay ? 'bili_playing' : 'bili_current') }}</span></span>
            <span :class="$style.duration">{{ item.interval }}</span><svg :class="$style.playIcon" viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 7 5-7 5z" /></svg>
          </button>
        </div>
        <div v-if="total > limit" :class="$style.pagination">
          <button type="button" :disabled="loading || page <= 1" @click="load(mode, page - 1)">{{ $t('pagination__prev') }}</button>
          <span>{{ page }} / {{ Math.ceil(total / limit) }}</span>
          <button type="button" :disabled="loading || page * limit >= total" @click="load(mode, page + 1)">{{ $t('pagination__next') }}</button>
        </div>
        <p :class="$style.hint">{{ $t(appSetting['list.singlePlayMode'] == 'add' ? 'bili_play_hint_add' : 'bili_play_hint') }}</p>
      </div>
    </material-modal>
  </span>
</template>

<script setup>
import { computed, nextTick, ref, shallowRef, onBeforeUnmount, watch } from 'vue'
import { bilibiliClient } from '@renderer/utils/musicSdk/bi'
import { toNewMusicInfo } from '@renderer/utils'
import { playFromPage } from '@renderer/core/player/selection'
import { isPlay, playMusicInfo } from '@renderer/store/player/state'
import { appSetting } from '@renderer/store/setting'
const props = defineProps({ music: { type: Object, required: true }, player: Boolean, dark: Boolean })
const shown = ref(false)
const mounted = ref(false)
const loading = ref(false)
const error = ref(false)
const contents = shallowRef(null)
const list = shallowRef([])
const mode = ref('parts')
const page = ref(1)
const total = ref(0)
const query = ref('')
const rows = ref(null)
const limit = 30
const activeSong = computed(() => {
  const song = playMusicInfo.musicInfo
  return song && 'progress' in song ? song.metadata.musicInfo : song
})
const activeId = computed(() => activeSong.value?.source == 'bi' ? String(activeSong.value.meta.songId) : '')
const partIndex = id => contents.value?.parts.findIndex((item, index) => item.songmid == id || (index == 0 && id == item.songmid.split(':')[0] + ':0')) ?? -1
const currentPartIndex = computed(() => partIndex(activeId.value))
const filteredParts = computed(() => {
  const text = query.value.trim().toLocaleLowerCase()
  return contents.value?.parts.filter((item, index) => !text || item.name.toLocaleLowerCase().includes(text) || String(index + 1) == text) ?? []
})
const isCurrent = item => mode.value == 'parts'
  ? item === contents.value?.parts[currentPartIndex.value]
  : activeId.value.split(':')[0] == item.songmid.split(':')[0]
let controller
const close = () => { controller?.abort(); shown.value = false }
const load = async(nextMode, nextPage) => {
  controller?.abort()
  const current = controller = new AbortController()
  mode.value = nextMode; page.value = nextPage; loading.value = true; error.value = false; list.value = []
  try {
    if (nextMode == 'parts') {
      total.value = filteredParts.value.length
      list.value = filteredParts.value.slice((nextPage - 1) * limit, nextPage * limit)
    } else {
      const result = await bilibiliClient.collection(contents.value.collection.url, nextPage, limit, current.signal)
      if (current.signal.aborted) return
      if (result.incomplete) throw new Error('incomplete')
      total.value = result.total; list.value = result.list
    }
  } catch { if (!current.signal.aborted) error.value = true } finally { if (!current.signal.aborted) loading.value = false }
  await nextTick()
  if (!current.signal.aborted && rows.value) rows.value.scrollTop = 0
}
const filterParts = value => { query.value = value; void load('parts', 1) }
const scrollToCurrent = async() => {
  await nextTick()
  rows.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
}
const locateCurrent = async() => {
  if (currentPartIndex.value < 0) return
  query.value = ''
  await load('parts', Math.floor(currentPartIndex.value / limit) + 1)
  await scrollToCurrent()
}
const open = async() => {
  close()
  mounted.value = true
  shown.value = true; loading.value = true; error.value = false; contents.value = null; list.value = []; total.value = 0; mode.value = 'parts'; page.value = 1; query.value = ''
  const current = controller = new AbortController()
  try {
    const result = await bilibiliClient.videoContents(String(props.music.meta.songId), current.signal)
    if (current.signal.aborted) return
    contents.value = result
    const nextMode = result.parts.length == 1 && result.collection ? 'collection' : 'parts'
    const index = currentPartIndex.value >= 0 ? currentPartIndex.value : Math.max(partIndex(String(props.music.meta.songId)), 0)
    await load(nextMode, nextMode == 'parts' ? Math.floor(index / limit) + 1 : 1)
    await scrollToCurrent()
  } catch { if (!current.signal.aborted) { error.value = true; loading.value = false } }
}
const play = async(index) => {
  // 多 P 使用完整分 P 队列；跨视频合集只使用当前明确展示的一页。
  const tracks = mode.value == 'parts' ? contents.value.parts : list.value
  const selected = mode.value == 'parts' ? contents.value.parts.indexOf(list.value[index]) : index
  try { await playFromPage(`bilibili:${props.music.id}:${mode.value}:${page.value}`, tracks.map(toNewMusicInfo), selected); close() } catch { error.value = true }
}
watch(() => String(props.music.meta.songId).split(':')[0], close)
onBeforeUnmount(close)
</script>

<style lang="less" module>
.entry { display: inline-flex; flex: none; }
.trigger { border: 1px solid rgb(from var(--color-primary) r g b / .24); border-radius: 7px; padding: 4px 9px; color: var(--color-primary); background: rgb(from var(--color-primary) r g b / .06); cursor: pointer; white-space: nowrap; font-size: 11px; }
.playerTrigger { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 28px; padding: 4px 9px; border-radius: 9px; font-size: 12px; transition: background-color .16s ease, transform .16s ease; }
.playerTrigger svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.playerTrigger:hover { background: rgb(from var(--color-primary) r g b / .14); }
.playerTrigger:active { transform: scale(.96); }
.darkTrigger { color: rgba(255, 255, 255, .9); border-color: rgba(255, 255, 255, .2); background: rgba(255, 255, 255, .08); &:hover { background: rgba(255, 255, 255, .16); } }
.panel { padding: 0 20px 16px; display: flex; flex-flow: column; min-height: 0; flex: 1; overflow: hidden; color: var(--color-font); }
.panel > :not(.rows) { flex-shrink: 0; }
:global(body:has(#container.show-player-detail)) .panel { --color-primary: #e5ebf5; }
.panel h3 { font-size: 13px; font-weight: 500; line-height: 1.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 14px; color: var(--color-font-label); }
.panel p { font-size: 12px; line-height: 1.6; color: var(--color-font-label); }
.tabs { display: flex; gap: 4px; margin-bottom: 12px; padding: 3px; border-radius: 11px; background: rgb(from var(--color-font) r g b / .04); }
.tabs button { flex: 1; background: transparent; }
.tabs button, .pagination button { border: 0; font: inherit; padding: 8px 12px; border-radius: 8px; color: var(--color-font); background: rgb(from var(--color-font) r g b / .05); cursor: pointer; }
.tabs button[aria-selected=true] { color: var(--color-primary); background: rgb(from var(--color-primary) r g b / .12); }
.hint { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgb(from var(--color-font) r g b / .08); font-size: 11px !important; }
.rows { min-height: 0; max-height: 45vh; flex: 1; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
.findBar { display: flex; gap: 10px; margin: 2px 0 12px; align-items: center; }
.findBar input { min-width: 0; flex: 1; padding: 9px 12px; border: 1px solid rgb(from var(--color-font) r g b / .14); border-radius: 9px; background: rgb(from var(--color-font) r g b / .03); color: var(--color-font); font: inherit; }
.findBar button { border: 0; background: transparent; color: var(--color-primary); font: inherit; cursor: pointer; padding: 8px; border-radius: 8px; }
.row { border: 0; background: transparent; font: inherit; display: flex; align-items: center; width: 100%; gap: 10px; min-height: 48px; text-align: left; padding: 9px 10px; border-radius: 9px; box-sizing: border-box; color: var(--color-font); cursor: pointer; transition: background-color .15s ease; }
.row:hover { background: rgb(from var(--color-primary) r g b / .09); }
.currentRow { background: rgb(from var(--color-primary) r g b / .09); box-shadow: inset 3px 0 var(--color-primary); }
.currentLabel { flex: none; font-size: 11px; color: var(--color-primary); }
.number { width: 24px; flex: none; font-size: 12px; color: var(--color-font-label); }
.track { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.name { line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.playIcon { width: 14px; height: 14px; flex: none; fill: currentColor; opacity: .45; }
.row:hover .playIcon, .currentRow .playIcon { color: var(--color-primary); opacity: 1; }
.panel button:focus-visible, .findBar input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
.duration { flex: none; font-size: 12px; color: var(--color-font-label); }
.pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 12px; font-size: 12px; }
.pagination button:disabled { opacity: .4; cursor: default; }
.status { padding: 28px 0; text-align: center; }
</style>
