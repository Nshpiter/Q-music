<template>
  <span :class="$style.title" :title="music.name">
    <span :class="$style.artwork" aria-hidden="true">
      <img v-if="music.meta?.picUrl && failedUrl != music.meta.picUrl" :src="music.meta.picUrl" alt="" loading="lazy" decoding="async" @error="failedUrl = music.meta.picUrl">
      <svg v-else viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".6" /></svg>
    </span>
    <span :class="$style.name">{{ music.name }}</span>
  </span>
</template>

<script setup>
import { ref } from '@common/utils/vueTools'
defineProps({ music: { type: Object, required: true } })
const failedUrl = ref('')
</script>

<style lang="less" module>
.title { display: inline-flex !important; align-items: center; min-width: 0; max-width: 100%; gap: 9px; vertical-align: middle; }
.artwork { flex: 0 0 28px; width: 28px; height: 28px; border-radius: 6px; overflow: hidden; background: rgb(from var(--color-font) r g b / .05); }
.artwork img { display: block; width: 100%; height: 100%; object-fit: cover; }
.artwork svg { width: 20px; height: 20px; margin: 4px; fill: none; stroke: var(--color-font-label); stroke-width: 1.3; opacity: .65; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
</style>
