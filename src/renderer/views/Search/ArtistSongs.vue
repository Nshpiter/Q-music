<template>
  <section :class="$style.panel">
    <header>
      <div><h2>{{ artistName }}</h2><p>{{ $t('artist_all_songs') }}</p></div>
      <base-btn min @click="searchByName">{{ $t('player__search_artist', { name: artistName }) }}</base-btn>
    </header>
    <HoyoReleases v-if="String(route.params.id) === '12487174'" />
    <material-online-list
:list="tracks" :page="page" :limit="limit" :total="total" :no-item="label"
      source-tag search-results play-in-context @toggle-page="changePage" @retry="load" @play-list="play"
/>
  </section>
</template>
<script setup>
import { computed, ref, shallowRef, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import singer from '@renderer/utils/musicSdk/wy/singer'
import HoyoReleases from './HoyoReleases.vue'
import getMusicInfo from '@renderer/utils/musicSdk/wy/musicInfo'
import { withBrowseTimeout } from '@renderer/store/browseRequest'
import { toNewMusicInfo } from '@renderer/utils'
import { playFromPage } from '@renderer/core/player/selection'
const router = useRouter()
const route = useRoute()
const artistName = computed(() => String(route.query.artist ?? ''))
const page = computed(() => Math.max(1, Number.parseInt(route.query.page, 10) || 1))
const limit = 50
const tracks = shallowRef([])
const total = ref(0)
const label = ref('')
let revision = 0
const load = async() => {
  const current = ++revision
  if (route.name !== 'ArtistSongs') return
  tracks.value = []
  total.value = 0
  label.value = window.i18n.t('list__loading')
  try {
    let id = route.params.id
    if (!id && /^\d+$/.test(route.query.song)) {
      const song = await withBrowseTimeout(getMusicInfo(route.query.song).promise)
      if (current !== revision) return
      id = song.ar?.find(item => item.name === artistName.value)?.id
      if (id) {
        await router.replace({ name: 'ArtistSongs', params: { id }, query: { artist: artistName.value } })
        return
      }
    }
    if (!/^[1-9]\d*$/.test(id)) throw Error('artist_missing')
    const result = await withBrowseTimeout(singer.getSongList(id, page.value, limit))
    if (current !== revision) return
    tracks.value = result.list.map(song => toNewMusicInfo(song))
    total.value = result.total
    label.value = tracks.value.length ? '' : window.i18n.t('no_item')
  } catch {
    if (current === revision) label.value = window.i18n.t('list__load_failed')
  }
}
const searchByName = async() => router.push({ path: '/search', query: { text: artistName.value, type: 'music', source: 'wy' } })
const changePage = async next => router.push({ name: 'ArtistSongs', params: route.params, query: { ...route.query, page: next } })
const play = async(index) => playFromPage('wy_artist_' + String(route.params.id) + '_' + page.value, tracks.value, index)
watch(() => route.fullPath, load, { immediate: true })
onBeforeUnmount(() => { revision++ })
</script>
<style module lang="less">
@import '@renderer/assets/styles/layout.less';
.panel { display: flex; height: 100%; box-sizing: border-box; flex-direction: column; padding-bottom: @height-player; min-height: 0; }
.panel header { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px 12px; gap: 12px; border-bottom: 1px solid var(--q-outline); }
.panel h2 { font-weight: 650; font-size: 1.4em; }
.panel p { margin-top: 5px; color: var(--color-font-label); }
</style>
