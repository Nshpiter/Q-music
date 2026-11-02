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
    <div v-else :class="$style.grid">
      <button v-for="item in list.slice(offset, offset + 6)" :key="`${item.source}:${item.id}`" type="button" :class="$style.card" @click="open(item)">
        <span :class="$style.cover"><img v-if="item.img && !failed.has(item.id)" :src="item.img" alt="" loading="lazy" @error="failed.add(item.id)"><svg-icon v-else name="music" /><i aria-hidden="true">›</i></span>
        <strong :title="item.name">{{ item.name }}</strong>
        <small>{{ item.total ? $t('search__daily_count', { count: item.total }) : item.author || $t('discovery_playlist') }}</small>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, onBeforeUnmount } from 'vue'
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
  } finally { if (current == revision) loading.value = false }
}
const selectChoice = (id: string) => { choice.value = id; page.value = 1; offset.value = 0 }
const next = () => { if (offset.value + 6 < list.value.length) offset.value += 6; else { offset.value = 0; page.value++ } }
const previous = () => { if (offset.value > 0) offset.value -= 6; else { offset.value = -1; page.value-- } }
watch(() => props.provider, () => { choice.value = 'hot'; page.value = 1; offset.value = 0 }, { flush: 'sync' })
watch(() => [props.provider, choice.value, page.value], load, { immediate: true })
onBeforeUnmount(() => { revision++ })
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
.paging button, .choices button, .empty button { color: var(--color-font); background: rgb(from var(--color-font) r g b / .04); border: 1px solid transparent; border-radius: 18px; padding: 8px 13px; cursor: pointer; }
.paging button:disabled { opacity: .4; cursor: default; }
.choices { margin-bottom: 16px; }
.choices .selected { color: var(--color-primary); background: rgb(from var(--color-primary) r g b / .1); border-color: rgb(from var(--color-primary) r g b / .2); }
.grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; }
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
@media (max-width: 980px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .cover img { transition: none; } }
</style>
