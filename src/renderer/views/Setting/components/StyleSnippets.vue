<template>
  <details :class="$style.editor">
    <summary>{{ $t('style_snippets') }} <small v-if="snippets.length" :class="$style.count">({{ snippets.length }})</small></summary>
    <div :class="$style.panel">
      <div :class="$style.actions">
        <base-btn min @click="create">{{ $t('style_new') }}</base-btn>
        <base-btn min outline @click="choosingComponent = true">{{ $t('hide_component') }}</base-btn>
        <base-btn min outline @click="picker?.click()">{{ $t('style_import') }}</base-btn>
        <input ref="picker" type="file" accept=".css,text/css" multiple hidden @change="importFiles">
      </div>
      <p>{{ $t('hide_component_help') }}</p>
      <p v-if="readFailed || styleSaveFailed" :class="$style.errorText" role="alert">{{ $t(readFailed ? 'style_read_failed' : 'style_save_failed') }}</p>
      <p v-if="snippets.length">{{ $t('style_recover') }}</p>
      <div v-if="snippets.length" :class="$style.list">
        <div v-for="item in snippets" :key="item.id" :class="$style.item">
          <div :class="$style.row">
            <base-checkbox :id="'snippet_' + item.id" v-model="item.enabled" :label="item.name" />
            <base-btn min outline :aria-expanded="editing == item.id" @click="editing = editing == item.id ? '' : item.id">{{ $t('style_edit') }}</base-btn>
          </div>
          <div v-if="editing == item.id" :class="$style.fields">
            <input v-model="item.name" :aria-label="$t('style_name')" :placeholder="$t('style_name')">
            <textarea v-model="item.css" aria-label="CSS" spellcheck="false" placeholder="#player { opacity: .95; }" />
            <base-btn min outline :class="$style.removeBtn" @click="remove(item.id)">{{ $t('style_remove') }}</base-btn>
          </div>
        </div>
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
  max-width: 580px;
  p { margin: 0; color: var(--color-font-label); font-size: 12.5px; line-height: 1.55; }
}
.count { font-weight: 500; color: var(--color-font-label); }
.panel { display: grid; gap: 10px; padding-top: 8px; }
.actions, .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.row { justify-content: space-between; }
.list { display: grid; gap: 8px; }
.item {
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--q-surface);
  box-shadow: inset 0 0 0 1px var(--q-outline);
}
.fields {
  display: grid; gap: 8px; padding-top: 10px;
  textarea { min-height: 96px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.5; }
}
.removeBtn { justify-self: end; }
.errorText { color: #e25555 !important; }
</style>
