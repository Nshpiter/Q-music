<template>
  <details @toggle="refresh">
    <summary>{{ $t('better_plugins') }}</summary>
    <div :class="$style.panel">
      <p :class="$style.help">{{ $t('plugin_help') }}</p>
      <div :class="$style.toolbar">
        <base-btn min :disabled="busy" @click="picker.click()">{{ $t('plugin_install') }}</base-btn>
        <base-btn min outline :disabled="busy" @click="editScript()">{{ $t('plugin_new_script') }}</base-btn>
        <input ref="picker" type="file" accept=".plugin,.zip" hidden @change="install">
      </div>
      <form v-if="editor" :class="$style.editor" @submit.prevent="saveScript">
        <input v-model.trim="editor.name" required maxlength="96" :aria-label="$t('style_name')" :placeholder="$t('style_name')">
        <textarea v-model="editor.script" required maxlength="131072" rows="7" spellcheck="false" aria-label="JavaScript" />
        <div :class="$style.toolbar">
          <button type="submit" :class="$style.primaryBtn" :disabled="busy">{{ $t('model_save') }}</button>
          <base-btn min outline @click="editor = null">{{ $t('cancel_button_text') }}</base-btn>
        </div>
      </form>
      <div v-if="entries.length" :class="$style.list">
        <div v-for="item in entries" :key="item.id" :class="$style.cardRow">
          <div :class="$style.caption">
            <div :class="$style.titleRow">
              <strong>{{ item.name }}</strong>
              <span v-if="item.version" :class="$style.versionBadge">{{ item.version }}</span>
            </div>
            <p v-if="item.error" :class="$style.errorText" role="alert">{{ item.error }}</p>
          </div>
          <div :class="$style.rowActions">
            <base-checkbox :id="'better_plugin_' + item.id" :disabled="busy" :model-value="item.enabled" :label="$t('plugin_autostart')" @update:model-value="command({ action: $event ? 'enable' : 'disable', id: item.id })" />
            <base-btn v-if="item.editable" min outline :disabled="busy" @click="editScript(item)">{{ $t('style_edit') }}</base-btn>
            <base-btn min :disabled="busy" @click="command({ action: 'open', id: item.id })">{{ $t('plugin_open') }}</base-btn>
            <base-btn min outline :disabled="busy" @click="command({ action: 'remove', id: item.id })">{{ $t('style_remove') }}</base-btn>
          </div>
        </div>
      </div>
      <details @toggle.stop="catalogToggle">
        <summary>{{ $t('plugin_market') }}</summary>
        <div :class="$style.marketPanel">
          <div :class="$style.sourceRow">
            <label :class="$style.sourceField">
              <span>{{ $t('plugin_catalog_source') }}</span>
              <input v-model.trim="source" type="url" list="better-sources" :disabled="busy" @input="rows = []" @keydown.enter="browse">
              <datalist id="better-sources"><option v-for="url in sources" :key="url" :value="url" /></datalist>
            </label>
            <base-btn min :disabled="busy" @click="browse">{{ $t('plugin_catalog_load') }}</base-btn>
          </div>
          <input v-if="rows.length" v-model.trim="search" type="search" :placeholder="$t('plugin_catalog_search')" :aria-label="$t('plugin_catalog_search')">
          <div v-if="filtered.length" class="scroll" :class="$style.results">
            <div v-for="item in filtered" :key="item.id" :class="$style.cardRow">
              <div :class="$style.caption">
                <div :class="$style.titleRow">
                  <strong>{{ item.name }}</strong>
                  <span v-if="item.version" :class="$style.versionBadge">{{ item.version }}</span>
                </div>
                <p v-if="item.description">{{ item.description }}</p>
              </div>
              <div :class="$style.rowActions">
                <base-btn v-if="pluginSettings.has(item.id.toLowerCase())" min outline @click="goToSetting(item)">{{ $t('plugin_builtin_settings') }}</base-btn>
                <span v-if="item.native" :class="$style.statusTag">{{ $t('plugin_host_native') }}</span>
                <span v-else-if="installed(item)" :class="[$style.statusTag, $style.installedTag]">{{ $t('plugin_installed') }}</span>
                <base-btn v-else min :disabled="busy" @click="command({ action: 'download', id: item.id, source })">{{ $t('plugin_catalog_install') }}</base-btn>
              </div>
            </div>
          </div>
        </div>
      </details>
      <p v-if="message" :class="$style.statusMessage" role="status">{{ $t(message) }} {{ detail }}</p>
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
.panel { display: grid; gap: 12px; padding: 8px 0 4px; max-width: 640px; }
.help { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--color-font-label); }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.editor { display: grid; gap: 8px; padding: 12px; border-radius: 12px; background: var(--q-surface); box-shadow: inset 0 0 0 1px var(--q-outline); }
.editor textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.5; resize: vertical; }
.primaryBtn {
  min-height: 26px; padding: 4px 12px; border: 0; border-radius: 10px;
  font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  color: #fff; background: linear-gradient(145deg, var(--color-primary-light-100), var(--color-primary));
  box-shadow: 0 4px 12px var(--color-primary-alpha-700);
}
.primaryBtn:disabled { opacity: .45; cursor: default; box-shadow: none; }
.list { display: grid; gap: 8px; }
.marketPanel { display: grid; gap: 10px; padding-top: 8px; }
.sourceRow { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; }
.sourceField { flex: 1; min-width: 220px; display: grid; gap: 6px; font-size: 12.5px; color: var(--color-font-label); }
.sourceField input { width: 100%; }
.results { display: grid; gap: 6px; max-height: min(45vh, 430px); overflow-y: auto; padding-right: 4px; }
.cardRow {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 14px;
  padding: 10px 12px; border-radius: 12px; background: var(--q-surface);
  box-shadow: inset 0 0 0 1px var(--q-outline);
}
.caption { flex: 1; min-width: 180px; }
.titleRow { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.titleRow strong { font-size: 13.5px; font-weight: 650; overflow-wrap: anywhere; }
.versionBadge { padding: 1px 6px; border-radius: 6px; font-size: 11px; color: var(--color-font-label); background: rgb(from var(--color-font) r g b / .07); }
.caption p { font-size: 12px; line-height: 1.45; margin: 4px 0 0; color: var(--color-font-label); }
.errorText { color: #e25555 !important; }
.rowActions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.statusTag { padding: 3px 9px; border-radius: 999px; font-size: 11.5px; color: var(--color-font-label); background: rgb(from var(--color-font) r g b / .07); }
.installedTag { color: var(--color-primary-font); background: var(--color-primary-alpha-900); }
.statusMessage { margin: 0; font-size: 12.5px; color: var(--color-primary-font); }
</style>
