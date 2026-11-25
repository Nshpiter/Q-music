<template>
  <section :class="$style.section" :aria-busy="loading">
    <header :class="$style.header">
      <div><h3>{{ $t('home_hot_artists') }}</h3><p>{{ $t('home_hot_artists_source') }}</p></div>
    </header>
    <div v-if="artists.length" :class="$style.shelfWrap">
      <button
        v-if="canScrollLeft" type="button" :class="[$style.shelfArrow, $style.shelfPrev]"
        :aria-label="$t('discovery_previous')" @click="scrollShelf(-1)"
      >‹</button>
      <div ref="shelfRef" :class="$style.shelf" @scroll="syncScrollState">
        <button v-for="artist in artists" :key="artist.id" type="button" :class="$style.card" @click="open(artist)">
          <span :class="$style.avatar">
            <img v-if="artist.picture" :src="artist.picture" alt="" loading="lazy">
            <span v-else :class="$style.fallback">♫</span>
          </span>
          <strong :title="artist.name">{{ artist.name }}</strong>
        </button>
      </div>
      <button
        v-if="canScrollRight" type="button" :class="[$style.shelfArrow, $style.shelfNext]"
        :aria-label="$t('discovery_next')" @click="scrollShelf(1)"
      >›</button>
    </div>
    <div v-else-if="loading" :class="$style.shelf" :aria-label="$t('loading')">
      <div v-for="index in 6" :key="index" :class="$style.skeleton"><i /><b /></div>
    </div>
    <div v-else :class="$style.empty" role="status">
      <button type="button" :class="$style.retry" @click="load">{{ $t('discovery_failed') }} · {{ $t('search__retry') }}</button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getPopularArtists } from '@renderer/core/popularArtists'
import type { PopularArtist } from '@common/utils/popularArtists'
const artists = ref<PopularArtist[]>([])
const loading = ref(false)
const shelfRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const syncScrollState = () => {
  const el = shelfRef.value
  if (!el) { canScrollLeft.value = false; canScrollRight.value = false; return }
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}
const scrollShelf = (direction: -1 | 1) => {
  const el = shelfRef.value
  if (!el) return
  const step = Math.max(180, Math.round(el.clientWidth * 0.72))
  el.scrollBy({
    left: direction * step,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}
let active = true
const router = useRouter()
const load = async() => {
  loading.value = true
  try {
    const list = await getPopularArtists()
    if (active) {
      artists.value = list
      void nextTick(syncScrollState)
    }
  } catch { /* 热门区域失败不阻塞推荐。 */ } finally { if (active) loading.value = false }
}
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver != 'undefined') {
    resizeObserver = new ResizeObserver(syncScrollState)
    if (shelfRef.value) resizeObserver.observe(shelfRef.value)
  }
  void load()
})
watch(shelfRef, (el, prev) => {
  if (prev) resizeObserver?.unobserve(prev)
  if (el) { resizeObserver?.observe(el); void nextTick(syncScrollState) }
})
onBeforeUnmount(() => { active = false; resizeObserver?.disconnect() })
const open = (artist: PopularArtist) => { void router.push({ name: 'ArtistSongs', params: { id: artist.id }, query: { artist: artist.name } }) }
</script>
<style module lang="less">
.section { order: 4; flex-shrink: 0; margin-top: 24px; color: var(--color-font); }
.header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.header h3 { font-size: 18px; font-weight: 650; margin: 0 0 7px; }
.header p { font-size: 12px; color: var(--color-font-label); line-height: 1.5; margin: 0; }
.shelfWrap { position: relative; }
.shelf {
  display: flex; overflow-x: auto; gap: 20px; padding: 4px 4px 10px; scroll-snap-type: x proximity;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; width: 0; height: 0; }
}
.shelfArrow {
  position: absolute; top: 34px; z-index: 3; width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid var(--q-border); background: var(--q-menu-bg); color: var(--color-font);
  backdrop-filter: blur(14px) saturate(1.3); box-shadow: 0 8px 20px rgba(24, 34, 45, .14);
  display: grid; place-items: center; font-size: 20px; line-height: 1; cursor: pointer;
  opacity: 0; transform: scale(.92);
  transition: opacity .2s ease, transform .2s cubic-bezier(.22, 1, .36, 1), background-color .2s ease;
}
.shelfWrap:hover .shelfArrow, .shelfWrap:focus-within .shelfArrow { opacity: 1; transform: scale(1); }
.shelfArrow:hover { background: var(--q-surface-strong); color: var(--color-primary); transform: scale(1.06); }
.shelfPrev { left: 6px; }
.shelfNext { right: 6px; }
.card {
  flex: 0 0 98px; display: flex; flex-direction: column; align-items: center;
  background: transparent; border: 0; color: inherit; cursor: pointer;
  scroll-snap-align: start; border-radius: 14px; padding: 4px;
  transition: color .2s ease;
}
.avatar {
  width: 90px; height: 90px; border-radius: 50%; overflow: hidden;
  display: grid; place-items: center; background: rgb(from var(--color-font) r g b / .05);
  box-shadow: inset 0 0 0 1px var(--q-outline), 0 6px 16px rgba(24, 34, 45, .08);
}
.avatar img { width: 100%; height: 100%; object-fit: cover; transition: transform .25s ease; }
.fallback { font-size: 26px; color: var(--color-font-label); opacity: .65; }
.card strong {
  display: block; width: 100%; margin-top: 10px; font-size: 13px; font-weight: 550; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.card:hover .avatar img { transform: scale(1.05); }
.card:hover strong { color: var(--color-primary); }
.section button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.skeleton { flex: 0 0 98px; display: flex; flex-direction: column; align-items: center; padding: 4px; }
.skeleton i { width: 90px; height: 90px; border-radius: 50%; background: rgb(from var(--color-font) r g b / .05); }
.skeleton b { width: 64px; height: 10px; margin-top: 12px; border-radius: 5px; background: rgb(from var(--color-font) r g b / .05); }
.empty { min-height: 110px; display: flex; align-items: center; justify-content: center; }
.retry {
  color: var(--color-font); border: 1px solid var(--q-outline); border-radius: 18px;
  background: rgb(from var(--color-font) r g b / .04); padding: 8px 16px; cursor: pointer;
}
.retry:hover { border-color: var(--color-primary-alpha-600); color: var(--color-primary); }
@media (prefers-reduced-motion: reduce) { .avatar img, .shelfArrow { transition: none; } }
</style>
