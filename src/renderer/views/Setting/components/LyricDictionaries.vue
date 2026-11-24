<template>
  <details @toggle="onToggle">
    <summary>{{ $t('lyric_dictionary') }}</summary>
    <base-checkbox id="lyric_dictionary" :model-value="appSetting['playDetail.dictionary']" :label="$t('dict_lookup')" @update:model-value="updateSetting({ 'playDetail.dictionary': $event })" />
    <div><label>{{ $t('dict_import') }} <input type="file" accept=".zip" :disabled="busy" @change="importFile"></label></div>
    <div v-for="entry in entries" :key="entry.title">{{ entry.title }} · {{ entry.count }} <base-btn min :disabled="busy" @click="remove(entry.title)">{{ $t('style_remove') }}</base-btn></div>
    <p v-if="status" role="status">{{ $t(status) }}</p>
  </details>
</template>
<script setup>
import { ref } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { dictionaryRequest } from '@renderer/utils/lyricDictionary'
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
<style scoped>details > div { margin-top: 8px; } summary { cursor: pointer; padding-block: 6px; }</style>
