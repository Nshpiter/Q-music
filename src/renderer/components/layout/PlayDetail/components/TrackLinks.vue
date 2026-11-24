<template>
  <button type="button" :class="$style.trigger" :title="$t('track_links')" :aria-label="$t('track_links')" aria-haspopup="dialog" @click="open">···</button>
  <material-modal :show="visible" :heading="$t('track_links')" width="400px" max-width="94%" bg-close @close="visible = false">
    <div v-if="track" :class="$style.panel">
      <strong>{{ track.name }}</strong>
      <div :class="$style.actions">
        <button type="button" @click="chooseCover">{{ $t('track_cover_select') }}</button>
        <button v-if="customCover" type="button" @click="applyCover(track, '')">{{ $t('track_cover_reset') }}</button>
        <button type="button" :disabled="editingLyrics" @click="chooseLyrics">{{ $t('track_lyric_select') }}</button>
        <template v-if="lyricFile">
          <button type="button" @click="openDirInExplorer(lyricFile)">{{ $t('track_lyric_locate') }}</button>
          <button type="button" :disabled="editingLyrics" @click="applyLyrics(track, lyricFile)">{{ $t('track_lyric_reload') }}</button>
          <button type="button" :disabled="editingLyrics" @click="applyLyrics(track, '')">{{ $t('track_lyric_reset') }}</button>
        </template>
        <button v-if="shareUrl" type="button" @click="copy(shareUrl)">{{ $t('track_copy_link') }}</button>
        <button v-if="track.source != 'local' && track.meta.songId != null" type="button" @click="copy(String(track.meta.songId))">{{ $t('track_copy_id') }}</button>
        <a v-for="site in maps" :key="site.name" :href="site.url + query" @click.prevent="openUrl(site.url + query)">{{ site.name }}</a>
        <button v-for="action in pluginActions" :key="action.id + ':' + action.key" type="button" :title="action.name" @click="invokeAction(action)">{{ action.label }}</button>
      </div>
      <p v-if="coverError" role="alert">{{ $t('track_cover_error') }}</p>
      <p v-if="lyricError" role="alert">{{ $t('track_lyric_error') }}</p>
      <VocaDbInfo v-if="visible" :key="track.id" :name="track.name" :singer="track.singer" />
      <template v-if="artist">
        <select v-if="artists.length > 1" v-model="artist" :aria-label="$t('player__search_artist', { name: artist })"><option v-for="name in artists" :key="name">{{ name }}</option></select>
        <strong v-else>{{ artist }}</strong>
        <div :class="$style.actions"><a v-for="site in artistSites" :key="site.name" :href="site.url + encodeURIComponent(artist)" @click.prevent="openUrl(site.url + encodeURIComponent(artist))">{{ site.name }}</a></div>
      </template>
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
const open = async() => {
  const current = playMusicInfo.musicInfo
  if (!current) return
  coverError.value = false
  track.value = 'progress' in current ? current.metadata.musicInfo : current
  lyricError.value = false
  artist.value = artists.value[0] || ''
  visible.value = true
  pluginActions.value = await managePlugin({ action: 'actions' }).catch(() => [])
}
const copy = text => {
  clipboardWriteText(text)
  visible.value = false
}
</script>

<style module lang="less">
.trigger { border: 0; border-radius: 6px; padding: 0 8px; color: inherit; background: transparent; font: inherit; cursor: pointer; }
.trigger:hover, .trigger:focus-visible { background: rgb(from currentColor r g b / .12); }
.panel { display: grid; gap: 12px; padding: 8px 20px 20px; overflow-y: auto; max-height: 65vh; }
.panel strong { overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; }
.actions a, .actions button, .panel select { font: inherit; color: inherit; border: 1px solid var(--q-outline); border-radius: 7px; background: var(--q-surface-strong); padding: 6px 10px; text-decoration: none; cursor: pointer; }
</style>
