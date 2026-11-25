<template>
  <details :class="$style.releases" @toggle="open">
    <summary>{{ $t('hoyo_releases') }}</summary>
    <p v-if="status" :class="$style.status" role="status">{{ $t(status) }} <base-btn v-if="status === 'list__load_failed'" min @click="load">{{ $t('search__retry') }}</base-btn></p>
    <div v-if="albums.length" :class="$style.grid">
      <button v-for="album in albums" :key="album.id" type="button" :class="$style.chip" @click="show(album)">
        <strong>{{ album.name }}</strong>
        <span>{{ album.date }}</span>
      </button>
    </div>
  </details>
</template>
<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { httpFetch } from '@renderer/utils/request'
import { recentHoyoAlbums } from '@common/utils/hoyoReleases'
const router = useRouter()
const albums = ref([])
const status = ref('')
let request
const load = async() => {
  status.value = 'list__loading'
  const current = request = httpFetch('https://www.kugou.com/yy/?r=singer/album&sid=O34QK0ECB21E3', { timeout: 12000 })
  try {
    const { body, statusCode } = await current.promise
    if (request !== current) return
    if (statusCode !== 200) throw Error('hoyo_unavailable')
    albums.value = recentHoyoAlbums(typeof body === 'string' ? JSON.parse(body) : body)
    status.value = albums.value.length ? '' : 'hoyo_empty'
  } catch { if (request === current) status.value = 'list__load_failed' }
}
const open = event => { if (event.target.open && !request) void load() }
const show = async(album) => router.push({ path: '/search', query: { source: 'kg', type: 'album', text: album.name, page: 1, albumSource: 'kg', albumId: album.id, albumName: album.name, albumSinger: album.artist, albumPic: album.image } })
onBeforeUnmount(() => { request?.cancelHttp?.(); request = null })
</script>
<style module>
.releases {
  margin: 0 24px 10px; max-height: 28vh; overflow: auto;
  padding: 4px 14px; border-radius: 14px; background: var(--q-surface-soft);
  box-shadow: inset 0 0 0 1px var(--q-outline);
}
.releases[open] { padding-bottom: 12px; }
.releases summary {
  list-style: none; display: flex; align-items: center; gap: 8px;
  color: var(--color-primary); font-size: 13px; font-weight: 600; cursor: pointer; padding: 7px 0;
}
.releases summary::-webkit-details-marker { display: none; }
.releases summary::after {
  content: ''; width: 6px; height: 6px; margin-left: auto;
  border-right: 1.6px solid currentColor; border-bottom: 1.6px solid currentColor;
  transform: rotate(45deg) translateY(-1px); opacity: .7; transition: transform .18s ease;
}
.releases[open] summary::after { transform: rotate(-135deg) translateY(-1px); }
.status { display: flex; align-items: center; gap: 8px; margin: 4px 0 0; font-size: 12.5px; color: var(--color-font-label); }
.grid { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; }
.chip {
  display: inline-flex; align-items: center; gap: 8px;
  font: inherit; font-size: 12.5px; color: var(--color-font);
  background: var(--q-surface); border: 1px solid var(--q-outline);
  padding: 6px 11px; border-radius: 10px; cursor: pointer;
  transition: background-color .18s ease, border-color .18s ease;
}
.chip:hover { background: var(--q-surface-strong); border-color: var(--color-primary-alpha-600); }
.chip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.chip span { font-size: 11.5px; color: var(--color-font-label); font-variant-numeric: tabular-nums; }
</style>
