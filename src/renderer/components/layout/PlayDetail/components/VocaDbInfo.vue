<template>
  <div :class="$style.lookup">
    <button type="button" :class="$style.toggle" :aria-expanded="expanded" @click="expanded = !expanded">
      <span>VocaDB</span>
      <span :class="[$style.chevron, { [$style.chevronOpen]: expanded }]" aria-hidden="true" />
    </button>
    <div v-if="expanded" :class="$style.card">
      <p v-if="status" :class="$style.status" role="status">{{ $t(status) }}</p>
      <a v-if="status === 'vocadb_error' || status === 'vocadb_empty'" :class="$style.linkPill" :href="searchUrl" @click.prevent="openUrl(searchUrl)">{{ $t('vocadb_search') }} ↗</a>
      <article v-for="entry of entries" :key="entry.id" :class="$style.entry">
        <a :class="$style.entryTitle" :href="'https://vocadb.net/S/' + entry.id" @click.prevent="openUrl('https://vocadb.net/S/' + entry.id)">{{ entry.name }} ↗</a>
        <div :class="$style.meta">{{ [entry.artistString, entry.publishDate].filter(Boolean).join(' · ') }}</div>
        <div v-if="entry.artists.length" :class="$style.tags"><a v-for="artist in entry.artists" :key="artist.id" :class="$style.tag" :href="'https://vocadb.net/Ar/' + artist.id" :title="artist.role" @click.prevent="openUrl('https://vocadb.net/Ar/' + artist.id)">{{ artist.name }}</a></div>
        <div v-if="entry.videos.length" :class="$style.tags"><a v-for="video of entry.videos" :key="video.url" :class="$style.linkPill" :href="video.url" @click.prevent="openUrl(video.url)">{{ video.name }} ↗</a></div>
      </article>
    </div>
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
.lookup { display: grid; justify-items: stretch; gap: 8px; padding-top: 10px; border-top: 1px solid var(--q-outline); }
.toggle {
  justify-self: start; display: inline-flex; align-items: center; gap: 8px;
  font: inherit; font-size: 12.5px; font-weight: 600; color: inherit;
  border: 1px solid var(--q-outline); border-radius: 9px; background: var(--q-surface);
  padding: 6px 11px; cursor: pointer; transition: background-color .18s ease, border-color .18s ease;
}
.toggle:hover { background: var(--q-surface-strong); border-color: var(--color-primary-alpha-600); }
.toggle:focus-visible, .card a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.chevron {
  width: 6px; height: 6px; border-right: 1.6px solid currentColor; border-bottom: 1.6px solid currentColor;
  transform: rotate(45deg) translateY(-1px); opacity: .65; transition: transform .18s ease;
}
.chevronOpen { transform: rotate(-135deg) translateY(-1px); }
.card { display: grid; gap: 8px; padding: 10px 12px; border-radius: 12px; background: var(--q-surface-soft); border: 1px solid var(--q-outline); }
.status { margin: 0; font-size: 12px; color: var(--color-font-label); }
.entry { display: grid; gap: 6px; padding: 6px 0; }
.entry + .entry { border-top: 1px solid var(--q-outline); padding-top: 10px; }
.entryTitle { color: var(--color-primary); font-weight: 600; font-size: 13px; text-decoration: none; }
.entryTitle:hover { text-decoration: underline; }
.meta { font-size: 12px; color: var(--color-font-label); line-height: 1.45; }
.tags { display: flex; flex-wrap: wrap; gap: 5px; }
.tag, .linkPill {
  font-size: 11.5px; color: var(--color-font); text-decoration: none;
  padding: 3px 8px; border-radius: 7px; background: var(--q-surface); border: 1px solid var(--q-outline);
}
.tag:hover, .linkPill:hover { border-color: var(--color-primary-alpha-600); color: var(--color-primary); }
</style>
