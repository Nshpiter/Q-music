<template>
  <details :class="$style.editor">
    <summary>{{ $t('style_snippets') }} <small v-if="snippets.length">({{ snippets.length }})</small></summary>
    <div :class="$style.actions">
      <base-btn min @click="create">{{ $t('style_new') }}</base-btn>
      <base-btn min @click="choosingComponent = true">{{ $t('hide_component') }}</base-btn>
      <base-btn min @click="picker?.click()">{{ $t('style_import') }}</base-btn>
      <input ref="picker" type="file" accept=".css,text/css" multiple hidden @change="importFiles">
    </div>
    <p>{{ $t('hide_component_help') }}</p>
    <p v-if="readFailed || styleSaveFailed" role="alert">{{ $t(readFailed ? 'style_read_failed' : 'style_save_failed') }}</p>
    <p v-if="snippets.length">{{ $t('style_recover') }}</p>
    <div v-for="item in snippets" :key="item.id" :class="$style.item">
      <div :class="$style.row">
        <base-checkbox :id="'snippet_' + item.id" v-model="item.enabled" :label="item.name" />
        <button type="button" :aria-expanded="editing == item.id" @click="editing = editing == item.id ? '' : item.id">{{ $t('style_edit') }}</button>
      </div>
      <div v-if="editing == item.id" :class="$style.fields">
        <input v-model="item.name" :aria-label="$t('style_name')" :placeholder="$t('style_name')">
        <textarea v-model="item.css" aria-label="CSS" spellcheck="false" placeholder="#player { opacity: .95; }" />
        <button type="button" @click="remove(item.id)">{{ $t('style_remove') }}</button>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { ref } from '@common/utils/vueTools'
import { addSnippet, choosingComponent, snippets, styleSaveFailed } from '@renderer/store/styleSnippets'
import { useI18n } from '@renderer/plugins/i18n'

const t = useI18n()
const editing = ref('')
const readFailed = ref(false)
const picker = ref<HTMLInputElement | null>(null)
const create = () => { editing.value = addSnippet(t('style_new')) }
const remove = (id: string) => {
  snippets.value = snippets.value.filter(item => item.id != id)
  editing.value = ''
}
const importFiles = async(event: Event) => {
  const input = event.currentTarget as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  readFailed.value = false
  for (const file of files) {
    try {
      editing.value = addSnippet(file.name, await file.text())
    } catch { readFailed.value = true }
  }
}
</script>

<style module lang="less">
.editor {
  max-width: 520px;
  summary { cursor: pointer; padding: 8px 0; }
  small, p { color: var(--color-font-label); }
  p { font-size: 12px; line-height: 1.5; }
}
.actions, .row { display: flex; align-items: center; gap: 10px; }
.row { justify-content: space-between; }
.actions { padding-bottom: 8px; }
.item { border-top: 1px solid var(--q-border); padding: 8px 0; }
.item button { font: inherit; cursor: pointer; color: var(--color-primary); background: transparent; border: 0; padding: 5px 8px; }
.fields {
  display: grid; gap: 8px; padding-top: 8px;
  button { justify-self: end; }
  input, textarea { color: inherit; font: inherit; border: 1px solid var(--q-border); border-radius: 8px; padding: 8px; background: var(--color-content-background); }
  textarea { min-height: 90px; resize: vertical; font-family: monospace; }
}
</style>
