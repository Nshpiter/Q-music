<template>
  <details id="model-lyrics" @toggle="load">
    <summary>{{ $t('model_lyrics') }}</summary>
    <div :class="$style.content">
      <form v-if="form" :class="$style.form" @submit.prevent="save()">
        <label><span>{{ $t('model_endpoint') }}</span><input v-model.trim="form.endpoint" type="url" required></label>
        <label><span>{{ $t('model_name') }}</span><input v-model.trim="form.model" required></label>
        <label><span>{{ $t('model_target') }}</span><input v-model.trim="form.target" required></label>
        <label><span>API Key</span><input v-model="key" type="password" autocomplete="off" :placeholder="kept ? $t('model_key_saved') : ''"></label>
        <div :class="$style.checkLine">
          <base-checkbox id="model_auto_translate" :model-value="appSetting['playDetail.automaticTranslation']" :label="$t('model_auto_translate')" @update:model-value="updateSetting({ 'playDetail.automaticTranslation': $event })" />
        </div>
        <div :class="$style.formActions">
          <button type="submit" :class="$style.primaryBtn">{{ $t('model_save') }}</button>
          <button v-if="kept" type="button" :class="$style.ghostBtn" @click="save(true)">{{ $t('model_key_clear') }}</button>
        </div>
      </form>
      <div v-if="form" :class="$style.batch">
        <label :class="$style.batchSelect">
          <span>{{ $t('model_batch_list') }}</span>
          <select v-model="listId" :disabled="batch.active">
            <option v-for="list in lists" :key="list.id" :value="list.id">{{ list.name }}</option>
          </select>
        </label>
        <button v-if="batch.active" type="button" :class="$style.ghostBtn" :disabled="batch.stopping" @click="batch.stopping = true">{{ $t('model_batch_stop') }}</button>
        <button v-else type="button" :class="$style.secondaryBtn" @click="runBatch">{{ $t('model_batch_start') }}</button>
        <p v-if="batch.total || batch.current" :class="$style.progressText" role="status">{{ $t('model_batch_progress', { total: batch.total, saved: batch.saved, skipped: batch.skipped, failed: batch.failures.length }) }} {{ batch.current }}</p>
        <details v-if="batch.failures.length" :class="$style.failures"><summary>{{ $t('model_batch_failed') }}</summary><ul><li v-for="(failure, i) in batch.failures" :key="i">{{ failure }}</li></ul></details>
      </div>
      <p v-if="status" :class="$style.status" role="status">{{ status }}</p>
    </div>
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
.content { display: grid; gap: 14px; padding-top: 8px; max-width: 520px; }
.form { display: grid; gap: 10px; }
.form label { display: grid; grid-template-columns: 6.5em 1fr; align-items: center; gap: 10px; font-size: 13px; }
.form label span { color: var(--color-font-label); }
.form input { min-width: 0; width: 100%; }
.checkLine { padding-left: calc(6.5em + 10px); }
.formActions { display: flex; flex-wrap: wrap; gap: 8px; padding-left: calc(6.5em + 10px); }
.primaryBtn {
  min-height: 28px; padding: 5px 14px; border: 0; border-radius: 10px;
  font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
  color: #fff; background: linear-gradient(145deg, var(--color-primary-light-100), var(--color-primary));
  box-shadow: 0 4px 12px var(--color-primary-alpha-700);
}
.secondaryBtn {
  min-height: 28px; padding: 5px 12px; border: 0; border-radius: 10px;
  font: inherit; font-size: 12.5px; font-weight: 550; cursor: pointer;
  color: var(--color-button-font); background: var(--color-button-background);
  box-shadow: inset 0 0 0 1px var(--q-border);
}
.secondaryBtn:hover:not(:disabled) { background: var(--color-button-background-hover); color: var(--color-primary-dark-300); }
.ghostBtn {
  min-height: 28px; padding: 5px 12px; border: 0; border-radius: 10px;
  font: inherit; font-size: 12.5px; cursor: pointer;
  color: var(--color-font-label); background: transparent;
  box-shadow: inset 0 0 0 1px var(--q-outline);
}
.ghostBtn:hover:not(:disabled) { background: var(--q-surface-strong); color: var(--color-font); }
.primaryBtn:disabled, .secondaryBtn:disabled, .ghostBtn:disabled { opacity: .45; cursor: default; }
.batch {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  padding: 12px; border-radius: 12px; background: var(--q-surface); box-shadow: inset 0 0 0 1px var(--q-outline);
}
.batchSelect { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.batchSelect select { max-width: 210px; }
.progressText { width: 100%; margin: 0; font-size: 12.5px; color: var(--color-font-label); }
.failures { width: 100%; }
.failures ul { margin: 6px 0 0; padding-left: 18px; font-size: 12px; color: var(--color-font-label); display: grid; gap: 4px; }
.status { margin: 0; font-size: 12.5px; color: var(--color-primary-font); }
</style>
