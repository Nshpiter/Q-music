<template>
  <section :class="$style.section" :aria-busy="loading">
    <header><h3>{{ $t('home_hot_artists') }}</h3><span>{{ $t('home_hot_artists_source') }}</span></header>
    <div v-if="artists.length" :class="$style.shelf">
      <button v-for="artist in artists" :key="artist.id" type="button" @click="open(artist.name)">
        <img v-if="artist.picture" :src="artist.picture" alt="" loading="lazy"><span v-else :class="$style.fallback">♫</span>
        <strong>{{ artist.name }}</strong>
      </button>
    </div>
    <p v-else-if="loading">{{ $t('loading') }}</p>
    <button v-else type="button" :class="$style.retry" @click="load">{{ $t('discovery_failed') }} · {{ $t('search__retry') }}</button>
  </section>
</template>
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getPopularArtists } from '@renderer/core/popularArtists'
import type { PopularArtist } from '@common/utils/popularArtists'
const artists = ref<PopularArtist[]>([])
const loading = ref(false)
let active = true
const router = useRouter()
const load = async() => {
  loading.value = true
  try { const list = await getPopularArtists(); if (active) artists.value = list } catch { /* 热门区域失败不阻塞推荐。 */ } finally { if (active) loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => { active = false })
const open = (name: string) => { void router.push({ path: '/search', query: { text: name, source: 'wy', type: 'music', page: 1 } }) }
</script>
<style module lang="less">
.section { order: 4; flex-shrink: 0; margin-top: 24px; color: var(--color-font); }
.section header { display: flex; gap: 12px; align-items: baseline; margin-bottom: 16px; }
.section h3 { font-size: 18px; font-weight: 650; } .section header span, .section p { font-size: 12px; color: var(--color-font-label); }
.shelf { display: flex; overflow-x: auto; gap: 22px; padding: 4px 4px 12px; scroll-snap-type: x proximity; }
.shelf button { flex: 0 0 98px; background: transparent; border: 0; color: inherit; cursor: pointer; scroll-snap-align: start; border-radius: 14px; padding: 4px; }
.shelf img, .fallback { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; display: grid; place-items: center; background: var(--q-surface-strong); }
.shelf strong { display: block; margin-top: 10px; font-size: 13px; text-align: center; }
.section button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.retry { color: inherit; border: 0; border-radius: 12px; background: var(--q-surface-strong); padding: 14px; cursor: pointer; }
</style>
