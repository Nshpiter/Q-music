<template>
  <details :class="$style.releases" @toggle="open">
    <summary>{{ $t('hoyo_releases') }}</summary>
    <p v-if="status" role="status">{{ $t(status) }} <base-btn v-if="status === 'list__load_failed'" min @click="load">{{ $t('search__retry') }}</base-btn></p>
    <button v-for="album in albums" :key="album.id" type="button" @click="show(album)"><strong>{{ album.name }}</strong> · {{ album.date }}</button>
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
.releases { margin: 0 24px 8px; max-height: 28vh; overflow: auto; }
.releases summary { color: var(--color-primary); cursor: pointer; padding: 6px 0; }
.releases button { color: inherit; background: var(--q-surface-strong); padding: 6px 10px; border-radius: 8px; margin: 4px; cursor: pointer; }
</style>
