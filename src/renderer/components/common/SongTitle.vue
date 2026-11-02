<template>
  <span ref="element" :class="$style.title" :title="music.name">
    <span :class="$style.artwork" aria-hidden="true">
      <img v-if="url" :src="url" alt="" loading="lazy" decoding="async" @error="handleError">
      <svg v-else viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".6" /></svg>
    </span>
    <span :class="$style.name">{{ music.name }}</span>
  </span>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { loadTrackArtwork } from '@renderer/utils/trackArtwork'
const props = defineProps({ music: { type: Object, required: true } })
const element = ref(null)
const url = ref('')
let observer
let visible = false
let revision = 0
let retried = false
const load = async(refresh = false) => {
  const current = ++revision
  const next = await loadTrackArtwork(props.music, refresh)
  if (current == revision) url.value = next
}
const handleError = () => {
  url.value = ''
  if (retried || !visible) return
  retried = true
  void load(true)
}
watch(() => [props.music, props.music.meta?.picUrl], () => {
  revision++
  retried = false
  url.value = props.music.meta?.picUrl || ''
  if (visible && !url.value) void load()
}, { immediate: true })
onMounted(() => {
  observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    if (visible && !url.value && !retried) void load()
  }, { rootMargin: '120px' })
  observer.observe(element.value)
})
onBeforeUnmount(() => { revision++; observer?.disconnect() })
</script>

<style lang="less" module>
.title { display: inline-flex !important; align-items: center; min-width: 0; max-width: 100%; gap: 9px; vertical-align: middle; }
.artwork { flex: 0 0 28px; width: 28px; height: 28px; border-radius: 6px; overflow: hidden; background: rgb(from var(--color-font) r g b / .05); }
.artwork img { display: block; width: 100%; height: 100%; object-fit: cover; }
.artwork svg { width: 20px; height: 20px; margin: 4px; fill: none; stroke: var(--color-font-label); stroke-width: 1.3; opacity: .65; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
</style>
