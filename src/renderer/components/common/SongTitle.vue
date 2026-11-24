<template>
  <span :class="$style.title" :title="music.name">
    <TrackArtwork :music="music" />
    <span :class="$style.name">{{ music.name }}</span>
    <BilibiliPartsButton v-if="music.source == 'bi'" :music="music" />
  </span>
</template>

<script setup>
import BilibiliPartsButton from './BilibiliPartsButton.vue'
import TrackArtwork from './TrackArtwork.vue'
defineProps({ music: { type: Object, required: true } })
</script>

<style lang="less" module>
.title { display: inline-flex !important; align-items: center; min-width: 0; max-width: 100%; gap: 9px; vertical-align: middle; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
</style>
