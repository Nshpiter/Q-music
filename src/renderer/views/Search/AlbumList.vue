<template>
  <div :class="$style.container">
    <template v-if="albumId">
      <header :class="$style.detailHeader">
        <button type="button" :class="$style.back" @click="backToAlbums">‹ {{ $t('album__back') }}</button>
        <img v-if="album.pic" :src="album.pic" alt="">
        <div :class="$style.identity">
          <h2>{{ album.name || $t('music_album') }}</h2>
          <p><source-icon :source="albumSource" :size="16" /> {{ album.singer }}<span v-if="tracks.length"> · {{ $t('album__tracks', { count: tracks.length }) }}</span></p>
        </div>
        <base-btn :disabled="loading || !tracks.length || queueLoading" @click="playAlbum(0, true)">{{ $t('list__play_all') }}</base-btn>
      </header>
      <div v-if="error" :class="$style.message" role="status"><p>{{ $t('list__load_failed') }}</p><base-btn @click="load">{{ $t('search__retry') }}</base-btn></div>
      <material-online-list
        v-else :list="tracks" :page="1" :limit="Math.max(1, tracks.length)" :total="tracks.length"
        :no-item="loading ? $t('list__loading') : !tracks.length ? $t('no_item') : ''"
        source-tag play-in-context @play-list="playAlbum"
      />
      <p v-if="queueError" :class="$style.warning" role="status">{{ $t('album__play_failed') }}</p>
    </template>
    <template v-else>
      <div v-if="!supported" :class="$style.message">
        <p>{{ $t('album__unsupported') }}</p>
        <div :class="$style.sources"><base-btn v-for="id in albumSources" :key="id" @click="changeSource(id)">{{ $t(`source_${id}`) }}</base-btn></div>
      </div>
      <div v-else-if="loading || error || !albums.length" :class="$style.message" role="status" :aria-busy="loading">
        <p>{{ $t(loading ? 'list__loading' : error ? 'list__load_failed' : 'no_item') }}</p>
        <base-btn v-if="error" @click="load">{{ $t('search__retry') }}</base-btn>
      </div>
      <template v-else>
        <p v-if="failedSources.length" :class="$style.warning" role="status">{{ $t('album__partial', { sources: failedSources.map(id => $t(`source_${id}`)).join('、') }) }} <button type="button" @click="load">{{ $t('search__retry') }}</button></p>
        <div ref="gridRef" :class="[$style.grid, 'scroll']">
          <button v-for="item in albums" :key="`${item.source}:${item.id}`" type="button" :class="$style.card" @click="openAlbum(item)">
            <div :class="$style.cover">
              <img v-if="item.pic" :src="item.pic" alt="" loading="lazy" @error="$event.target.style.visibility = 'hidden'">
              <span v-else aria-hidden="true">♪</span>
              <span :class="$style.source"><source-icon :source="item.source" :size="17" /><span>{{ $t(`source_${item.source}`) }}</span></span>
            </div>
            <strong :title="item.name">{{ item.name }}</strong>
            <span :class="$style.singer" :title="item.singer">{{ item.singer || '—' }}</span>
            <small>{{ item.date || '—' }}<span v-if="item.count"> · {{ $t('album__tracks', { count: item.count }) }}</span></small>
          </button>
        </div>
      </template>
      <footer v-if="supported && (page > 1 || hasMore)" :class="$style.pagination">
        <base-btn :disabled="loading || page <= 1" @click="changePage(page - 1)">{{ $t('pagination__prev') }}</base-btn>
        <span>{{ $t('pagination__page', { num: page }) }}</span>
        <base-btn :disabled="loading || error || !hasMore" @click="changePage(page + 1)">{{ $t('pagination__next') }}</base-btn>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount, nextTick } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'
import { albumSources, searchAlbums, getAlbumTracks } from '@renderer/store/search/albums'
import { addHistoryWord } from '@renderer/store/search/action'
import { setTempList } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player/action'
import { playFromPage } from '@renderer/core/player/selection'
import { LIST_IDS } from '@common/constants'

const props = defineProps({ source: { type: String, required: true }, page: { type: Number, required: true }, text: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
// 页面缓存期间保留本页参数，去设置等页面时不清空专辑和滚动位置。
const query = ref(route.query)
watch(() => route.query, value => { if (route.path == '/search') query.value = value })
const albumId = computed(() => typeof query.value.albumId == 'string' ? query.value.albumId : '')
const albumSource = computed(() => typeof query.value.albumSource == 'string' ? query.value.albumSource : props.source)
const supported = computed(() => props.source == 'all' || albumSources.includes(props.source))
const album = ref({})
const albums = ref([])
const tracks = ref([])
const failedSources = ref([])
const hasMore = ref(false)
const loading = ref(false)
const error = ref(false)
const queueLoading = ref(false)
const queueError = ref(false)
const gridRef = ref(null)
let revision = 0
// 返回专辑结果时恢复原页与滚动位置，不重复请求。
const searchCache = new Map()
const load = async() => {
  const current = ++revision
  error.value = false
  queueError.value = false
  tracks.value = []
  if (!albumId.value && !supported.value) { loading.value = false; return }
  const key = JSON.stringify([props.text, props.source, props.page])
  const cachedSearch = searchCache.get(key)
  if (!albumId.value && cachedSearch?.key == key) {
    albums.value = cachedSearch.result.list
    hasMore.value = cachedSearch.result.hasMore
    failedSources.value = cachedSearch.result.failedSources
    loading.value = false
    await nextTick()
    if (gridRef.value) gridRef.value.scrollTop = cachedSearch.scroll
    return
  }
  loading.value = true
  if (!albumId.value) { albums.value = []; hasMore.value = false; failedSources.value = [] }
  try {
    if (albumId.value) {
      const metadata = { name: query.value.albumName, singer: query.value.albumSinger, pic: query.value.albumPic }
      album.value = metadata
      const list = await getAlbumTracks(albumSource.value, albumId.value)
      if (current != revision) return
      tracks.value = list
      album.value = {
        name: list[0]?.meta.albumName ?? metadata.name,
        singer: metadata.singer ?? list[0]?.singer,
        pic: list[0]?.meta.picUrl || metadata.pic,
      }
    } else {
      void addHistoryWord(props.text)
      const result = await searchAlbums(props.text, props.source, props.page)
      if (current != revision) return
      albums.value = result.list
      hasMore.value = result.hasMore
      failedSources.value = result.failedSources
      if (!result.failedSources.length) {
        searchCache.clear()
        searchCache.set(key, { key, result, scroll: 0 })
      }
    }
  } catch {
    if (current == revision) error.value = true
  } finally {
    if (current == revision) loading.value = false
  }
}
const openAlbum = item => {
  const cachedSearch = searchCache.get(JSON.stringify([props.text, props.source, props.page]))
  if (cachedSearch) cachedSearch.scroll = gridRef.value?.scrollTop || 0
  album.value = item
  void router.push({ path: '/search', query: { ...route.query, albumId: item.id, albumSource: item.source, albumName: item.name, albumSinger: item.singer, albumPic: item.pic } })
}
const searchQuery = () => {
  const { albumId, albumSource, albumName, albumSinger, albumPic, ...query } = route.query
  return query
}
const backToAlbums = () => { void router.push({ path: '/search', query: searchQuery() }) }
const changePage = page => { searchCache.clear(); void router.push({ path: '/search', query: { ...searchQuery(), page } }) }
const changeSource = source => { void router.replace({ path: '/search', query: { ...searchQuery(), source, page: 1 } }) }
const playAlbum = async(index, all = false) => {
  if (queueLoading.value || !tracks.value[index]) return
  queueLoading.value = true
  queueError.value = false
  const current = revision
  try {
    if (!all) { await playFromPage(`album__${albumSource.value}__${albumId.value}`, tracks.value, index); return }
    await setTempList(`album__${albumSource.value}__${albumId.value}`, [...tracks.value])
    if (current == revision) playList(LIST_IDS.TEMP, index)
  } catch {
    if (current == revision) queueError.value = true
  } finally { queueLoading.value = false }
}
// 分别比较查询值，返回同一专辑时不能因 query 对象更新而清空曲目、重置滚动。
watch([() => props.source, () => props.page, () => props.text, albumId, albumSource], load, { immediate: true })
onBeforeUnmount(() => { revision++ })
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.container { display: flex; flex-direction: column; height: 100%; min-height: 0; padding-bottom: @height-player + 18px; box-sizing: border-box; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); align-content: start; gap: 24px 20px; padding: 18px 24px; min-height: 0; flex: 1; overflow-y: auto; }
.card {
  display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 0; border: 0;
  text-align: left; background: transparent; color: var(--color-font); cursor: pointer;
  strong, .singer, small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; line-height: 1.5; }
  strong { font-size: 13.5px; font-weight: 550; margin-top: 3px; transition: color .18s ease; }
  small, .singer { font-size: 12px; color: var(--color-font-label); }
  &:hover .cover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(24, 34, 45, .14), inset 0 0 0 1px var(--q-outline); }
  &:hover .cover > img { transform: scale(1.04); }
  &:hover strong { color: var(--color-primary); }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 5px; border-radius: 12px; }
}
.cover {
  position: relative; display: grid; place-items: center; aspect-ratio: 1; width: 100%;
  border-radius: 14px; overflow: hidden;
  background: rgb(from var(--color-font) r g b / .05);
  box-shadow: inset 0 0 0 1px var(--q-outline), 0 4px 12px rgba(24, 34, 45, .06);
  transition: transform .22s cubic-bezier(.22, 1, .36, 1), box-shadow .22s ease;
  > img { width: 100%; height: 100%; object-fit: cover; transition: transform .26s ease; }
  > span:not(.source) { font-size: 40px; color: var(--color-font-label); opacity: .55; }
}
.source {
  position: absolute; display: flex; align-items: center; gap: 5px; bottom: 8px; left: 8px;
  padding: 4px 8px; border-radius: 9px;
  background: var(--q-menu-bg); color: var(--color-font);
  box-shadow: inset 0 0 0 1px var(--q-border), 0 4px 12px rgba(0, 0, 0, .12);
  backdrop-filter: blur(10px); font-size: 11px;
}
.message { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; color: var(--color-font-label); }
.sources, .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; }
.pagination { flex: none; padding: 12px 20px; }
.warning {
  flex: none; padding: 10px 24px; color: var(--color-font-label); line-height: 1.5;
  button { border: 0; background: transparent; color: var(--color-primary); cursor: pointer; font: inherit; }
}
.detailHeader {
  display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding: 14px 24px; flex: none;
  border-bottom: 1px solid var(--q-outline);
  > img { width: 60px; height: 60px; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 12px rgba(24, 34, 45, .12), inset 0 0 0 1px var(--q-outline); }
  .identity { flex: 1; min-width: 140px; h2 { font-size: 1.25em; font-weight: 650; line-height: 1.5; } p { display: flex; align-items: center; gap: 6px; color: var(--color-font-label); margin-top: 6px; font-size: 13px; } }
}
.back {
  align-self: center; border: 0; border-radius: 10px;
  background: var(--q-surface); box-shadow: inset 0 0 0 1px var(--q-outline);
  color: var(--color-primary); cursor: pointer; padding: 6px 12px; font: inherit; font-size: 13px;
  transition: background-color .18s ease, transform .14s ease;
  &:hover { background: var(--q-surface-strong); }
  &:active { transform: scale(.97); }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .cover, .cover > img, .back { transition: none; }
}
</style>
