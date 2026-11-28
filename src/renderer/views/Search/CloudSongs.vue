<template>
  <div :class="$style.panel">
    <material-online-list
      :list="tracks" :page="1" :limit="Math.max(1, tracks.length)" :total="tracks.length" :no-item="label"
      source-tag play-in-context @play-list="play" @retry="load"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { searchNeteaseCloud } from '@renderer/utils/ipc'
import { playFromPage } from '@renderer/core/player/selection'
const props = defineProps<{ text: string }>()
const tracks = shallowRef<LX.Music.MusicInfoOnline[]>([])
const label = ref('')
let revision = 0
const load = async() => {
  const token = ++revision
  tracks.value = []
  label.value = window.i18n.t('list__loading')
  try {
    const list = await searchNeteaseCloud(props.text)
    if (revision !== token) return
    tracks.value = list
    label.value = list.length ? '' : window.i18n.t('search__empty')
  } catch (error) {
    if (revision === token) label.value = window.i18n.t(String(error).includes('login_required') ? 'wy_favorite_login_required' : 'list__load_failed')
  }
}
const play = async(index: number) => playFromPage('netease_cloud_' + props.text, tracks.value, index)
watch(() => props.text, load, { immediate: true })
</script>

<style module lang="less">
@import '@renderer/assets/styles/layout.less';
.panel {
  --online-list-end-inset: 16px;
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 4px 0 calc(@height-player - 6px) 16px;
}
.panel > * { flex: 1; min-height: 0; }
</style>
