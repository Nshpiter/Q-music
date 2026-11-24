<template>
  <details @toggle="refresh">
    <summary>{{ $t('better_plugins') }}</summary>
    <div :class="$style.panel">
      <p>{{ $t('plugin_help') }}</p>
      <div><base-btn min :disabled="busy" @click="picker.click()">{{ $t('plugin_install') }}</base-btn>
        <base-btn min :disabled="busy" @click="editScript()">{{ $t('plugin_new_script') }}</base-btn>
        <input ref="picker" type="file" accept=".plugin,.zip" hidden @change="install"></div>
      <form v-if="editor" :class="$style.editor" @submit.prevent="saveScript">
        <input v-model.trim="editor.name" required maxlength="96" :aria-label="$t('style_name')" :placeholder="$t('style_name')">
        <textarea v-model="editor.script" required maxlength="131072" rows="7" spellcheck="false" aria-label="JavaScript" />
        <div><button type="submit" :disabled="busy">{{ $t('model_save') }}</button> <button type="button" @click="editor = null">{{ $t('cancel_button_text') }}</button></div>
      </form>
      <div v-for="item in entries" :key="item.id" :class="$style.row">
        <div :class="$style.caption"><strong>{{ item.name }} <small>{{ item.version }}</small></strong><p v-if="item.error" role="alert">{{ item.error }}</p></div>
        <label><input type="checkbox" :disabled="busy" :checked="item.enabled" @change="command({ action: item.enabled ? 'disable' : 'enable', id: item.id })">{{ $t('plugin_autostart') }}</label>
        <base-btn v-if="item.editable" min :disabled="busy" @click="editScript(item)">{{ $t('style_edit') }}</base-btn>
        <base-btn min :disabled="busy" @click="command({ action: 'open', id: item.id })">{{ $t('plugin_open') }}</base-btn>
        <base-btn min :disabled="busy" @click="command({ action: 'remove', id: item.id })">{{ $t('style_remove') }}</base-btn>
      </div>
      <details @toggle.stop="catalogToggle">
        <summary>{{ $t('plugin_market') }}</summary>
        <div :class="$style.panel">
          <label>{{ $t('plugin_catalog_source') }}
            <input v-model.trim="source" type="url" list="better-sources" :disabled="busy" @input="rows = []" @keydown.enter="browse">
            <datalist id="better-sources"><option v-for="url in sources" :key="url" :value="url" /></datalist>
          </label>
          <base-btn min :disabled="busy" @click="browse">{{ $t('plugin_catalog_load') }}</base-btn>
          <input v-if="rows.length" v-model.trim="search" type="search" :placeholder="$t('plugin_catalog_search')" :aria-label="$t('plugin_catalog_search')">
          <div :class="$style.results">
            <div v-for="item in filtered" :key="item.id" :class="$style.row">
              <div :class="$style.caption"><strong>{{ item.name }} <small>{{ item.version }}</small></strong><p>{{ item.description }}</p></div>
              <base-btn v-if="pluginSettings.has(item.id.toLowerCase())" min @click="goToSetting(item)">{{ $t('plugin_builtin_settings') }}</base-btn>
              <small v-if="item.native">{{ $t('plugin_host_native') }}</small>
              <small v-else-if="installed(item)">{{ $t('plugin_installed') }}</small>
              <base-btn v-else min :disabled="busy" @click="command({ action: 'download', id: item.id, source })">{{ $t('plugin_catalog_install') }}</base-btn>
            </div>
          </div>
        </div>
      </details>
      <p v-if="message" role="status">{{ $t(message) }} {{ detail }}</p>
    </div>
  </details>
</template>
<script setup>
import { computed, ref } from 'vue'
import { managePlugin } from '@renderer/utils/ipc'
import { useRouter } from '@common/utils/vueRouter'
import { pluginSettings } from './pluginSettings'
const router = useRouter()
const goToSetting = async item => router.push({ path: '/setting', query: pluginSettings.get(item.id.toLowerCase()) })
const picker = ref(null)
const entries = ref([])
const busy = ref(false)
const message = ref('')
const detail = ref('')
const source = ref(window.localStorage.getItem('qmusic-better-source') ?? '')
const sources = ref([])
const rows = ref([])
const search = ref('')
const editor = ref(null)
const editScript = async item => {
  try {
    const script = item ? await managePlugin({ action: 'read-script', id: item.id }) : "plugin.onConfig(() => dom('p', { textContent: betterncm.ncm.getPlayingSong().data.name }))"
    editor.value = { id: item?.id, name: item?.name ?? '', script }
  } catch { message.value = 'plugin_missing' }
}
const saveScript = async() => {
  await command({ action: 'save-script', ...editor.value })
  if (!message.value) editor.value = null
}
const filtered = computed(() => rows.value.filter(row => (row.name + ' ' + row.description + ' ' + row.id).toLowerCase().includes(search.value.toLowerCase())))
const installed = item => entries.value.some(entry => entry.id.toLowerCase() === item.id.toLowerCase() && entry.version === item.version)
const catalogToggle = async event => {
  if (!event.target.open) return
  sources.value = await managePlugin({ action: 'sources' })
  if (!source.value) source.value = sources.value[0]
  if (!rows.value.length) await browse()
}
const browse = async() => {
  if (!source.value || busy.value) return
  await command({ action: 'catalog', source: source.value })
}
const command = async params => {
  if (busy.value) return
  busy.value = true
  message.value = ''
  detail.value = ''
  try {
    const result = await managePlugin(params)
    if (params.action === 'catalog') {
      rows.value = result
      window.localStorage.setItem('qmusic-better-source', params.source)
    } else entries.value = result
  } catch (err) {
    const error = String(err)
    message.value = ['plugin_runtime', 'plugin_native', 'plugin_size', 'plugin_dependency', 'plugin_cycle', 'plugin_missing', 'plugin_format', 'plugin_source_error'].find(key => error.includes(key)) ?? (['catalog', 'download'].includes(params.action) ? 'plugin_download' : 'plugin_format')
    if (['plugin_dependency', 'plugin_cycle', 'plugin_runtime'].includes(message.value)) detail.value = error.split(message.value + ': ').pop()
    if (params.action === 'catalog') rows.value = []
  } finally { busy.value = false }
}
const refresh = async event => { if (event.target.open) await command({ action: 'list' }) }
const install = async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 16 * 1024 * 1024) { message.value = 'plugin_size'; return }
  try { await command({ action: 'install', bytes: new Uint8Array(await file.arrayBuffer()) }) } catch { message.value = 'plugin_format' }
}
</script>
<style module>
.panel { display: grid; gap: 10px; padding: 10px 0; max-width: 550px; }
.panel p, .panel small { color: var(--color-font-label); }
.editor { display: grid; gap: 6px; }
.editor textarea { font-family: monospace; resize: vertical; }
.results { max-height: min(45vh, 430px); overflow: auto; }
.results .row { padding: 8px 0; border-bottom: 1px solid var(--q-outline); }
.caption { flex: 1; min-width: 0; }
.caption p { font-size: .9em; margin: 3px 0 0; }
.panel input[type=url] { width: 100%; box-sizing: border-box; }
.row { display: flex; align-items: center; gap: 8px; }
.row strong { flex: 1; overflow-wrap: anywhere; }
</style>
