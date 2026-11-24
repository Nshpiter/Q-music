<template>
  <img v-if="src" :src="src" :alt="alt" :class="$style.image">
  <span v-else>{{ alt }}</span>
</template>
<script setup>
import { ref, watch } from 'vue'
import { dictionaryRequest } from '@renderer/utils/lyricDictionary'
const props = defineProps({ dict: { type: String, required: true }, path: { type: String, default: '' }, alt: { type: String, default: '' } })
const src = ref('')
watch(() => [props.dict, props.path], async([dict, path], _, cleanup) => {
  let active = true
  let url
  src.value = ''
  cleanup(() => { active = false; if (url) URL.revokeObjectURL(url) })
  if (!path) return
  const blob = await dictionaryRequest('media', [dict, path]).catch(() => null)
  if (active && blob) src.value = url = URL.createObjectURL(blob)
}, { immediate: true })
</script>
<style module>
.image { max-width: 100%; max-height: 16em; object-fit: contain; }
</style>
