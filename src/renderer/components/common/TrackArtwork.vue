<template>
  <span ref="element" :class="$style.artwork" aria-hidden="true">
    <img v-if="url" :key="imageRevision" :src="url" alt="" loading="lazy" decoding="async" @error="handleError">
    <slot v-else><svg :class="$style.placeholder" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".6" /></svg></slot>
  </span>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { loadTrackArtwork } from '@renderer/utils/trackArtwork'
import { coverOverride } from '@renderer/store/coverOverrides'
const props = defineProps({ music: { type: Object, required: true } })
const element = ref(null)
const url = ref('')
const imageRevision = ref(0)
let retryTimer
let observer
let visible = false
let revision = 0
let retried = false
const load = async(refresh = false) => {
  const current = ++revision
  const next = await loadTrackArtwork(props.music, refresh)
  if (current != revision) return
  url.value = next
  if (!next && !retried && visible && props.music.source != 'local') {
    clearTimeout(retryTimer)
    retryTimer = setTimeout(handleError, 1200)
  }
}
const handleError = () => {
  url.value = ''
  if (retried || !visible) return
  retried = true
  clearTimeout(retryTimer)
  imageRevision.value++
  void load(true)
}
watch(() => [props.music, props.music.meta?.picUrl, coverOverride(props.music)], () => {
  revision++
  clearTimeout(retryTimer)
  retried = false
  url.value = coverOverride(props.music) || props.music.meta?.picUrl || ''
  if (visible) void load()
}, { immediate: true })
onMounted(() => {
  observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    if (visible && !retried) void load()
  }, { rootMargin: '120px' })
  observer.observe(element.value)
})
onBeforeUnmount(() => { revision++; clearTimeout(retryTimer); observer?.disconnect() })
</script>

<style lang="less" module>
.artwork { flex: none; width: var(--track-artwork-size, 28px); height: var(--track-artwork-size, 28px); display: grid; place-items: center; overflow: hidden; border-radius: var(--track-artwork-radius, 6px); background: rgb(from var(--color-font) r g b / .05); }
.artwork img { display: block; width: 100%; height: 100%; object-fit: cover; }
.placeholder { width: 20px; height: 20px; fill: none; stroke: var(--color-font-label); stroke-width: 1.3; opacity: .65; }
</style>
