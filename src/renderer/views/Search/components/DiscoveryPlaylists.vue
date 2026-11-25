<template>
  <section :class="$style.section" :aria-busy="loading">
    <header :class="$style.header">
      <div><h3>{{ $t('discovery_collections') }}</h3><p>{{ $t('discovery_collections_hint') }}</p></div>
      <div :class="$style.paging">
        <button type="button" :disabled="loading || (page == 1 && offset == 0)" @click="previous">{{ $t('discovery_previous') }}</button>
        <button type="button" :disabled="loading || (!hasNext && offset + 6 >= list.length)" @click="next">{{ $t('discovery_next') }}</button>
      </div>
    </header>
    <nav :class="$style.choices" :aria-label="$t('discovery_category')">
      <button v-for="option in choices" :key="option.id" type="button" :aria-pressed="choice == option.id" :class="{ [$style.selected]: choice == option.id }" @click="selectChoice(option.id)">{{ $t(option.label) }}</button>
    </nav>
    <div v-if="loading" :class="$style.grid" :aria-label="$t('list__loading')">
      <div v-for="index in 6" :key="index" :class="$style.skeleton"><i /><b /><b /></div>
    </div>
    <div v-else-if="error || !list.length" :class="$style.empty" role="status">
      <p>{{ $t(error ? 'discovery_failed' : 'discovery_empty') }}</p>
      <button type="button" @click="load">{{ $t('search__retry') }}</button>
    </div>
    <div v-else :class="$style.shelfWrap">
      <button
        v-if="canScrollLeft" type="button" :class="[$style.shelfArrow, $style.shelfPrev]"
        :aria-label="$t('discovery_previous')" @click="scrollShelf(-1)"
      >‹</button>
      <div ref="gridRef" :class="$style.grid" @scroll="syncScrollState">
        <button v-for="item in list.slice(offset, offset + 6)" :key="`${item.source}:${item.id}`" type="button" :class="$style.card" @click="open(item)">
          <span :class="$style.cover"><img v-if="item.img && !failed.has(item.id)" :src="item.img" alt="" loading="lazy" @error="failed.add(item.id)"><svg-icon v-else name="music" /><i aria-hidden="true">›</i></span>
          <strong :title="item.name">{{ item.name }}</strong>
          <small>{{ item.total ? $t('search__daily_count', { count: item.total }) : item.author || $t('discovery_playlist') }}</small>
        </button>
      </div>
      <button
        v-if="canScrollRight" type="button" :class="[$style.shelfArrow, $style.shelfNext]"
        :aria-label="$t('discovery_next')" @click="scrollShelf(1)"
      >›</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { discoveryChoices, getDiscoveryPlaylists } from '@renderer/core/discoveryPlaylists'
import type { DiscoveryPlaylist, DiscoveryProvider } from '@common/utils/discoveryPlaylists'

const props = defineProps<{ provider: DiscoveryProvider }>()
const choices = computed(() => discoveryChoices[props.provider as DiscoveryProvider])
const router = useRouter()
const route = useRoute()
const choice = ref('hot')
const page = ref(1)
const offset = ref(0)
const list = shallowRef<DiscoveryPlaylist[]>([])
const failed = ref(new Set<string>())
const loading = ref(false)
const error = ref(false)
const hasNext = ref(false)
const gridRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const syncScrollState = () => {
  const el = gridRef.value
  if (!el) { canScrollLeft.value = false; canScrollRight.value = false; return }
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}
const scrollShelf = (direction: -1 | 1) => {
  const el = gridRef.value
  if (!el) return
  const step = Math.max(180, Math.round(el.clientWidth * 0.72))
  el.scrollBy({
    left: direction * step,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}
let revision = 0
const load = async() => {
  const current = ++revision
  loading.value = true
  error.value = false
  list.value = []
  failed.value = new Set()
  try {
    const result = await getDiscoveryPlaylists(props.provider, choice.value, page.value)
    if (current != revision) return
    list.value = result.list
    if (offset.value < 0) offset.value = Math.max(0, Math.floor((result.list.length - 1) / 6) * 6)
    hasNext.value = result.list.length > 0 && page.value * result.limit < result.total
  } catch {
    if (current == revision) { error.value = true; hasNext.value = false }
  } finally {
    if (current == revision) {
      loading.value = false
      void nextTick(syncScrollState)
    }
  }
}
const selectChoice = (id: string) => { choice.value = id; page.value = 1; offset.value = 0 }
const next = () => { if (offset.value + 6 < list.value.length) offset.value += 6; else { offset.value = 0; page.value++ } }
const previous = () => { if (offset.value > 0) offset.value -= 6; else { offset.value = -1; page.value-- } }
watch(() => props.provider, () => { choice.value = 'hot'; page.value = 1; offset.value = 0 }, { flush: 'sync' })
watch(() => [props.provider, choice.value, page.value], load, { immediate: true })
watch(offset, () => {
  void nextTick(() => {
    if (gridRef.value) gridRef.value.scrollLeft = 0
    syncScrollState()
  })
})
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver != 'undefined') {
    resizeObserver = new ResizeObserver(syncScrollState)
    if (gridRef.value) resizeObserver.observe(gridRef.value)
  }
  syncScrollState()
})
watch(gridRef, (el, prev) => {
  if (prev) resizeObserver?.unobserve(prev)
  if (el) { resizeObserver?.observe(el); void nextTick(syncScrollState) }
})
onBeforeUnmount(() => { revision++; resizeObserver?.disconnect() })
const open = (item: DiscoveryPlaylist) => {
  void router.push({ path: '/songList/detail', query: { source: item.source, id: item.id, picUrl: item.img, fromName: String(route.name ?? '') } })
}
</script>

<style lang="less" module>
.section { order: 3; flex-shrink: 0; margin-top: 24px; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.header h3 { font-size: 18px; font-weight: 650; margin: 0 0 7px; }
.header p { font-size: 12px; color: var(--color-font-label); line-height: 1.5; margin: 0; }
.paging, .choices { display: flex; gap: 6px; flex-wrap: wrap; }
.paging { flex-shrink: 0; }
.paging button, .choices button, .empty button { color: var(--color-font); background: rgb(from var(--color-font) r g b / .04); border: 1px solid transparent; border-radius: 18px; padding: 8px 13px; cursor: pointer; transition: background-color .18s ease, border-color .18s ease, color .18s ease; }
.paging button:hover:not(:disabled), .choices button:hover, .empty button:hover { background: rgb(from var(--color-font) r g b / .08); }
.paging button:disabled { opacity: .4; cursor: default; }
.choices { margin-bottom: 16px; }
.choices .selected { color: var(--color-primary); background: rgb(from var(--color-primary) r g b / .1); border-color: rgb(from var(--color-primary) r g b / .2); }
.shelfWrap { position: relative; }
.grid {
  display: flex; gap: 16px; overflow-x: auto; padding: 4px 4px 10px; scroll-snap-type: x proximity;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; width: 0; height: 0; }
}
.shelfArrow {
  position: absolute; top: 64px; z-index: 3; width: 32px; height: 32px; border-radius: 50%;
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
.grid > * { flex: 0 0 154px; scroll-snap-align: start; }
.card { min-width: 0; color: var(--color-font); background: transparent; border: 0; padding: 0; text-align: left; cursor: pointer; border-radius: 12px; }
.card:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 4px; }
.cover { position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 12px; overflow: hidden; background: rgb(from var(--color-font) r g b / .05); }
.cover img { width: 100%; height: 100%; object-fit: cover; transition: transform .25s ease; }
.cover svg { width: 30px; height: 30px; opacity: .45; }
.cover i { position: absolute; right: 8px; bottom: 8px; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(0, 0, 0, .28); color: white; font-style: normal; font-size: 23px; }
.card:hover .cover img { transform: scale(1.035); }
.card strong { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13px; line-height: 1.6; margin: 8px 0 4px; font-weight: 550; }
.card small { display: block; font-size: 11px; color: var(--color-font-label); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.skeleton i { display: block; aspect-ratio: 1; border-radius: 12px; background: rgb(from var(--color-font) r g b / .05); }
.skeleton b { display: block; height: 10px; margin-top: 10px; border-radius: 5px; background: rgb(from var(--color-font) r g b / .05); }
.skeleton b:last-child { width: 60%; }
.empty { min-height: 150px; display: flex; align-items: center; justify-content: center; flex-direction: column; color: var(--color-font-label); gap: 12px; }
@media (max-width: 980px) { .grid > * { flex-basis: 140px; } }
@media (prefers-reduced-motion: reduce) { .cover img, .shelfArrow { transition: none; } }
</style>
