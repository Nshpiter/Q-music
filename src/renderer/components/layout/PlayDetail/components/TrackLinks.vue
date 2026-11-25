<template>
  <button type="button" :class="$style.trigger" :title="$t('track_links')" :aria-label="$t('track_links')" aria-haspopup="dialog" @click="open">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </svg>
  </button>
  <material-modal :show="visible" :heading="$t('track_links')" width="420px" max-width="94%" bg-close @close="visible = false">
    <div v-if="track" :class="$style.panel">
      <div :class="$style.trackHeader">
        <strong>{{ track.name }}</strong>
        <span v-if="track.singer">{{ track.singer }}</span>
      </div>
      <div :class="$style.section">
        <div :class="$style.actions">
          <button type="button" @click="chooseCover">{{ $t('track_cover_select') }}</button>
          <button v-if="customCover" type="button" @click="applyCover(track, '')">{{ $t('track_cover_reset') }}</button>
          <button type="button" :disabled="editingLyrics" @click="chooseLyrics">{{ $t('track_lyric_select') }}</button>
          <template v-if="lyricFile">
            <button type="button" @click="openDirInExplorer(lyricFile)">{{ $t('track_lyric_locate') }}</button>
            <button type="button" :disabled="editingLyrics" @click="applyLyrics(track, lyricFile)">{{ $t('track_lyric_reload') }}</button>
            <button type="button" :disabled="editingLyrics" @click="applyLyrics(track, '')">{{ $t('track_lyric_reset') }}</button>
          </template>
          <button v-if="shareUrl" type="button" @click="copy('link', shareUrl)">{{ $t('track_copy_link') }}<span v-if="copiedKey === 'link'" :class="$style.copiedTick">✓</span></button>
          <button v-if="track.source != 'local' && track.meta.songId != null" type="button" @click="copy('id', String(track.meta.songId))">{{ $t('track_copy_id') }}<span v-if="copiedKey === 'id'" :class="$style.copiedTick">✓</span></button>
        </div>
      </div>
      <div :class="$style.section">
        <div :class="$style.actions">
          <a v-for="site in maps" :key="site.name" :href="site.url + query" @click.prevent="openUrl(site.url + query)">{{ site.name }} ↗</a>
          <button v-for="action in pluginActions" :key="action.id + ':' + action.key" type="button" :title="action.name" @click="invokeAction(action)">{{ action.label }}</button>
        </div>
      </div>
      <p v-if="coverError" :class="$style.errorText" role="alert">{{ $t('track_cover_error') }}</p>
      <p v-if="lyricError" :class="$style.errorText" role="alert">{{ $t('track_lyric_error') }}</p>
      <VocaDbInfo v-if="visible" :key="track.id" :name="track.name" :singer="track.singer" />
      <div v-if="artist" :class="$style.artistSection">
        <select v-if="artists.length > 1" v-model="artist" :aria-label="$t('player__search_artist', { name: artist })"><option v-for="name in artists" :key="name">{{ name }}</option></select>
        <strong v-else :class="$style.artistName">{{ artist }}</strong>
        <div :class="$style.actions"><a v-for="site in artistSites" :key="site.name" :href="site.url + encodeURIComponent(artist)" @click.prevent="openUrl(site.url + encodeURIComponent(artist))">{{ site.name }} ↗</a></div>
      </div>
    </div>
  </material-modal>
</template>

<script setup>
import { computed, ref, shallowRef } from 'vue'
import { openUrl, clipboardWriteText } from '@common/utils/electron'
import { playMusicInfo } from '@renderer/store/player/state'
import { setMusicInfo } from '@renderer/store/player/action'
import { getPicPath, getLyricInfo } from '@renderer/core/music'
import { lyricFiles, readLyricFile } from '@renderer/core/music/lyricFile'
import { showSelectDialog, managePlugin, openDirInExplorer } from '@renderer/utils/ipc'
import { setCoverOverride, coverOverride } from '@renderer/store/coverOverrides'
import { toOldMusicInfo } from '@renderer/utils'
import musicSdk from '@renderer/utils/musicSdk'
import VocaDbInfo from './VocaDbInfo.vue'

const maps = [{ name: 'BeatSaver', url: 'https://beatsaver.com/?q=' }, { name: 'osu!', url: 'https://osu.ppy.sh/beatmapsets?q=' }]
const artistSites = [
  { name: 'Bilibili', url: 'https://search.bilibili.com/upuser?keyword=' },
  { name: 'Weibo', url: 'https://s.weibo.com/user?q=' },
  { name: '5sing', url: 'https://search.5sing.kugou.com/?keyword=' },
]
const visible = ref(false)
const pluginActions = ref([])
const invokeAction = async row => {
  try { await managePlugin({ action: 'invoke', id: row.id, key: row.key }) } catch {
    pluginActions.value = await managePlugin({ action: 'actions' }).catch(() => [])
  }
}
const track = shallowRef(null)
const coverError = ref(false)
const lyricError = ref(false)
const editingLyrics = ref(false)
const lyricFile = computed(() => track.value && lyricFiles.get(track.value))
const applyLyrics = async(item, path) => {
  editingLyrics.value = true
  lyricError.value = false
  try {
    const imported = path ? await readLyricFile(path, item) : null
    lyricFiles.set(item, path)
    const current = playMusicInfo.musicInfo
    const playing = current && ('progress' in current ? current.metadata.musicInfo : current)
    if (playing?.id !== item.id || playing.source !== item.source) return
    const info = imported ?? await getLyricInfo({ musicInfo: current })
    if (current !== playMusicInfo.musicInfo || lyricFiles.get(item) !== path) return
    setMusicInfo({ lrc: info.lyric, tlrc: info.tlyric ?? '', rlrc: info.rlyric ?? '', lxlrc: info.lxlyric ?? '', rawlrc: info.rawlrcInfo.lyric })
    window.app_event.lyricUpdated()
  } catch { lyricError.value = true } finally { editingLyrics.value = false }
}
const chooseLyrics = async() => {
  const item = track.value
  const result = await showSelectDialog({ properties: ['openFile'], filters: [{ name: 'LRC', extensions: ['lrc'] }] })
  if (!result.canceled && result.filePaths[0]) await applyLyrics(item, result.filePaths[0])
}
const customCover = computed(() => track.value && coverOverride(track.value))
const applyCover = async(item, file) => {
  try {
    setCoverOverride(item, file)
    const current = playMusicInfo.musicInfo
    const playing = current && ('progress' in current ? current.metadata.musicInfo : current)
    if (playing?.id !== item.id || playing.source !== item.source) return
    const pic = await getPicPath({ musicInfo: current, listId: playMusicInfo.listId }).catch(() => '')
    if (playMusicInfo.musicInfo === current) {
      setMusicInfo({ pic })
      window.app_event.picUpdated()
    }
    coverError.value = false
  } catch { coverError.value = true }
}
const chooseCover = async() => {
  const item = track.value
  const result = await showSelectDialog({ properties: ['openFile'], filters: [{ name: window.i18n.t('track_cover_select'), extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'] }] })
  if (!result.canceled && result.filePaths[0]) await applyCover(item, result.filePaths[0])
}
const artist = ref('')
const artists = computed(() => [...new Set((track.value?.singer || '').split('、').map(s => s.trim()).filter(Boolean))])
const query = computed(() => encodeURIComponent([track.value.name, track.value.singer].filter(Boolean).join(' ')))
const shareUrl = computed(() => {
  if (!track.value || track.value.source == 'local') return ''
  return musicSdk[track.value.source]?.getMusicDetailPageUrl?.(toOldMusicInfo(track.value)) || ''
})
const copiedKey = ref('')
let copyTimer
const open = async() => {
  const current = playMusicInfo.musicInfo
  if (!current) return
  coverError.value = false
  copiedKey.value = ''
  track.value = 'progress' in current ? current.metadata.musicInfo : current
  lyricError.value = false
  artist.value = artists.value[0] || ''
  visible.value = true
  pluginActions.value = await managePlugin({ action: 'actions' }).catch(() => [])
}
const copy = (key, text) => {
  clipboardWriteText(text)
  copiedKey.value = key
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copiedKey.value = '' }, 1400)
}
</script>

<style module lang="less">
.trigger {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 22px; padding: 0; border: 0; border-radius: 999px;
  color: inherit; background: transparent; cursor: pointer; opacity: .7;
  transition: opacity .18s ease, background-color .18s ease;
  svg { width: 15px; height: 15px; fill: currentColor; }
  &:hover, &:focus-visible { opacity: 1; background: rgb(from currentColor r g b / .14); }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
}
.panel { display: grid; gap: 12px; padding: 4px 20px 20px; overflow-y: auto; max-height: 68vh; }
.trackHeader { display: grid; gap: 3px; }
.trackHeader strong { font-size: 15px; font-weight: 650; line-height: 1.4; overflow-wrap: anywhere; }
.trackHeader span { font-size: 12px; color: var(--color-font-label); overflow-wrap: anywhere; }
.section { padding-top: 10px; border-top: 1px solid var(--q-outline); }
.artistSection { display: grid; gap: 8px; padding-top: 10px; border-top: 1px solid var(--q-outline); }
.artistName { font-size: 13px; font-weight: 600; }
.actions { display: flex; flex-wrap: wrap; gap: 7px; }
.actions a, .actions button, .panel select {
  font: inherit; font-size: 12.5px; color: inherit; text-decoration: none; cursor: pointer;
  border: 1px solid var(--q-outline); border-radius: 9px; background: var(--q-surface);
  padding: 6px 11px; transition: background-color .18s ease, border-color .18s ease, transform .14s ease;
}
.actions a:hover, .actions button:hover:not(:disabled), .panel select:hover {
  background: var(--q-surface-strong); border-color: var(--color-primary-alpha-600); transform: translateY(-1px);
}
.actions button:active:not(:disabled) { transform: scale(.97); }
.copiedTick { margin-inline-start: 5px; color: var(--color-primary); font-weight: 700; }
.actions a:focus-visible, .actions button:focus-visible, .panel select:focus-visible {
  outline: 2px solid var(--color-primary); outline-offset: 2px;
}
.actions button:disabled { opacity: .45; cursor: default; }
.panel select { justify-self: start; max-width: 100%; }
.panel select option { background: var(--color-content-background); color: var(--color-font); }
.errorText { margin: 0; font-size: 12px; color: #e25555; }
</style>
