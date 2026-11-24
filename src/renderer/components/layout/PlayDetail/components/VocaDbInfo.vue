<template>
  <div :class="$style.lookup">
    <button type="button" :aria-expanded="expanded" @click="expanded = !expanded">VocaDB</button>
    <template v-if="expanded">
      <p v-if="status" role="status">{{ $t(status) }}</p>
      <a v-if="status === 'vocadb_error' || status === 'vocadb_empty'" :href="searchUrl" @click.prevent="openUrl(searchUrl)">{{ $t('vocadb_search') }}</a>
      <article v-for="entry of entries" :key="entry.id">
        <a :href="'https://vocadb.net/S/' + entry.id" @click.prevent="openUrl('https://vocadb.net/S/' + entry.id)">{{ entry.name }}</a>
        <div>{{ [entry.artistString, entry.publishDate].filter(Boolean).join(' · ') }}</div>
        <div v-if="entry.artists.length"><a v-for="artist in entry.artists" :key="artist.id" :href="'https://vocadb.net/Ar/' + artist.id" :title="artist.role" @click.prevent="openUrl('https://vocadb.net/Ar/' + artist.id)">{{ artist.name }}</a></div>
        <a v-for="video of entry.videos" :key="video.url" :href="video.url" @click.prevent="openUrl(video.url)">{{ video.name }}</a>
      </article>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from '@common/utils/vueTools'
import { openUrl } from '@common/utils/electron'
import { queryVocaDb } from '@common/utils/vocaDb'

const props = defineProps({ name: { type: String, required: true }, singer: { type: String, required: true } })
const expanded = ref(false)
const searchUrl = computed(() => 'https://vocadb.net/Search?searchType=Song&filter=' + encodeURIComponent(props.name))
const status = ref('')
const entries = ref([])
watch([expanded, () => props.name, () => props.singer], async([show, name, singer], _, cleanup) => {
  entries.value = []
  if (!show) return
  const controller = new AbortController()
  cleanup(() => { controller.abort() })
  status.value = 'vocadb_loading'
  try {
    const list = await queryVocaDb(name, singer, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
    if (controller.signal.aborted) return
    entries.value = list
    status.value = list.length ? '' : 'vocadb_empty'
  } catch {
    if (!controller.signal.aborted) status.value = 'vocadb_error'
  }
})
</script>

<style module>
.lookup { display: grid; justify-items: start; gap: 6px; }
.lookup > button { font: inherit; color: inherit; border: 1px solid var(--q-outline); border-radius: 7px; background: var(--q-surface-strong); padding: 6px 10px; cursor: pointer; }
.lookup article { padding: 6px 0; }
.lookup article div { opacity: .75; }
.lookup a { color: var(--color-primary); margin-inline-end: 8px; }
</style>
