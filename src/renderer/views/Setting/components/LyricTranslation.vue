<template>
  <details id="model-lyrics" @toggle="load">
    <summary>{{ $t('model_lyrics') }}</summary>
    <form v-if="form" :class="$style.form" @submit.prevent="save()">
      <label>{{ $t('model_endpoint') }}<input v-model.trim="form.endpoint" type="url" required></label>
      <label>{{ $t('model_name') }}<input v-model.trim="form.model" required></label>
      <label>{{ $t('model_target') }}<input v-model.trim="form.target" required></label>
      <label><input type="checkbox" :checked="appSetting['playDetail.automaticTranslation']" @change="updateSetting({ 'playDetail.automaticTranslation': $event.target.checked })">{{ $t('model_auto_translate') }}</label>
      <label>API Key<input v-model="key" type="password" autocomplete="off" :placeholder="kept ? $t('model_key_saved') : ''"></label>
      <div><button type="submit">{{ $t('model_save') }}</button> <button v-if="kept" type="button" @click="save(true)">{{ $t('model_key_clear') }}</button></div>
    </form>
    <div v-if="form" :class="$style.batch">
      <label>{{ $t('model_batch_list') }}
        <select v-model="listId" :disabled="batch.active">
          <option v-for="list in lists" :key="list.id" :value="list.id">{{ list.name }}</option>
        </select>
      </label>
      <button v-if="batch.active" type="button" :disabled="batch.stopping" @click="batch.stopping = true">{{ $t('model_batch_stop') }}</button>
      <button v-else type="button" @click="runBatch">{{ $t('model_batch_start') }}</button>
      <p v-if="batch.total || batch.current" role="status">{{ $t('model_batch_progress', { total: batch.total, saved: batch.saved, skipped: batch.skipped, failed: batch.failures.length }) }} {{ batch.current }}</p>
      <details v-if="batch.failures.length"><summary>{{ $t('model_batch_failed') }}</summary><ul><li v-for="(failure, i) in batch.failures" :key="i">{{ failure }}</li></ul></details>
    </div>
    <p v-if="status" role="status">{{ status }}</p>
  </details>
</template>

<script setup>
import { computed, ref } from 'vue'
import { getTranslationProvider, saveTranslationProvider } from '@renderer/utils/ipc'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { useI18n } from '@renderer/plugins/i18n'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { translationBatch as batch, translatePlaylist } from '@renderer/core/lyricTranslation'

const t = useI18n()
const form = ref(null)
const saved = ref(null)
const key = ref('')
const status = ref('')
const listId = ref(loveList.id)
const lists = computed(() => [...[loveList, defaultList].map(list => ({ id: list.id, name: t(list.name) })), ...userLists])
const runBatch = async() => {
  status.value = ''
  try { await translatePlaylist(listId.value); if (!batch.total) status.value = t('model_batch_empty') } catch { status.value = t('model_batch_read_error') }
}
const kept = computed(() => saved.value?.hasKey && form.value?.endpoint === saved.value.endpoint)
const assign = value => {
  saved.value = value
  form.value = { endpoint: value.endpoint, model: value.model, target: value.target }
  key.value = ''
}
const load = async event => {
  if (!event.target.open || form.value) return
  try { assign(await getTranslationProvider()) } catch { status.value = t('model_save_failed') }
}
const save = async(clear = false) => {
  try {
    assign(await saveTranslationProvider({ ...form.value, key: clear ? '' : key.value || undefined }))
    status.value = t('model_saved')
  } catch { status.value = t('model_save_failed') }
}
</script>

<style module>
.form { display: grid; gap: 8px; margin: 10px 0; max-width: 420px; }
.form label { display: grid; grid-template-columns: 6em 1fr; align-items: center; }
.form input, .form button { min-width: 0; color: inherit; background: var(--q-surface-strong); border: 1px solid var(--q-outline); border-radius: 6px; padding: 6px 9px; font: inherit; }
.form button { cursor: pointer; }
.batch { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 460px; }
.batch select, .batch button { font: inherit; color: inherit; background: var(--q-surface-strong); border: 1px solid var(--q-outline); border-radius: 6px; padding: 5px 8px; max-width: 200px; }
.batch p, .batch details { width: 100%; }
</style>
