<template>
  <details @toggle="onToggle">
    <summary>{{ $t('lyric_dictionary') }}</summary>
    <div :class="$style.body">
      <base-checkbox id="lyric_dictionary" :model-value="appSetting['playDetail.dictionary']" :label="$t('dict_lookup')" @update:model-value="updateSetting({ 'playDetail.dictionary': $event })" />
      <div :class="$style.actions">
        <base-btn min :disabled="busy" @click="picker?.click()">{{ $t('dict_import') }}</base-btn>
        <input ref="picker" type="file" accept=".zip" hidden :disabled="busy" @change="importFile">
      </div>
      <div v-if="entries.length" :class="$style.list">
        <div v-for="entry in entries" :key="entry.title" :class="$style.entry">
          <span :class="$style.title">{{ entry.title }}</span>
          <span :class="$style.count">{{ entry.count }}</span>
          <base-btn min outline :disabled="busy" @click="remove(entry.title)">{{ $t('style_remove') }}</base-btn>
        </div>
      </div>
      <p v-if="status" :class="$style.status" role="status">{{ $t(status) }}</p>
    </div>
  </details>
</template>
<script setup>
import { ref } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { dictionaryRequest } from '@renderer/utils/lyricDictionary'
const picker = ref(null)
const entries = ref([])
const busy = ref(false)
const status = ref('')
const refresh = async() => { entries.value = await dictionaryRequest('list') }
const onToggle = async(event) => {
  if (!event.target.open) return
  try { await refresh() } catch { status.value = 'dict_failed' }
}
const remove = async(title) => {
  busy.value = true
  try { await dictionaryRequest('remove', title); await refresh(); status.value = '' } catch { status.value = 'dict_failed' } finally { busy.value = false }
}
const importFile = async(event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  busy.value = true
  status.value = 'dict_importing'
  try {
    if (file.size > 256 * 1024 * 1024) throw Error('dictionary_too_large')
    await dictionaryRequest('import', await file.arrayBuffer())
    await refresh()
    updateSetting({ 'playDetail.dictionary': true })
    status.value = 'dict_ready'
  } catch (error) { status.value = error.message === 'dictionary_too_large' ? 'dict_large' : 'dict_failed' } finally { busy.value = false }
}
</script>
<style module>
.body { display: grid; gap: 10px; padding-top: 8px; max-width: 520px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.list { display: grid; gap: 6px; }
.entry {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  border-radius: 12px; background: var(--q-surface); box-shadow: inset 0 0 0 1px var(--q-outline);
}
.title { flex: 1; min-width: 0; font-size: 13px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { padding: 1px 7px; border-radius: 999px; font-size: 11.5px; color: var(--color-font-label); background: rgb(from var(--color-font) r g b / .07); font-variant-numeric: tabular-nums; }
.status { margin: 0; font-size: 12.5px; color: var(--color-primary-font); }
</style>
