<template>
  <div :class="$style.main" :aria-busy="disabled || saving">
    <div class="scroll" :class="$style.grid">
      <base-btn
        v-for="item in lists" :key="item.id" type="button" :class="[$style.target, { [$style.exists]: item.isExist }]"
        :disabled="disabled || saving || item.isExist" @click="$emit('select', item.id)"
      >
        <PlaylistIdentity :list="item" subtitle local-copy />
        <span :class="$style.hint"><span aria-hidden="true">{{ item.isExist ? '✓' : '+' }}</span><span v-if="item.isExist"> {{ $t('favorite_local_exists') }}</span></span>
      </base-btn>
      <base-btn v-if="!editing" type="button" :class="[$style.target, $style.newList]" :disabled="disabled || saving" @click="startEditing">
        <svg-icon name="addTo" viewBox="0 0 42 42" />
        <span>{{ $t('lists__new_list_btn') }}</span>
      </base-btn>
      <form v-else :class="$style.editor" @submit.prevent="saveList">
        <base-input
          ref="input" v-model="name" :trim="false" :disabled="disabled || saving"
          :aria-label="$t('lists__new_list_input')" :placeholder="$t('lists__new_list_input')"
          @update:model-value="error = ''"
        />
        <div :class="$style.actions">
          <base-btn type="button" min :disabled="saving" @click="cancelEditing">{{ $t('btn_cancel') }}</base-btn>
          <base-btn type="submit" min :disabled="disabled || saving || !name.trim()">{{ $t('btn_save') }}</base-btn>
        </div>
      </form>
    </div>
    <p v-if="error" :class="$style.error" role="alert">{{ error }}</p>
    <p v-if="(disabled && showStatus) || saving" :class="$style.status" role="status">{{ $t('list_add__saving') }}</p>
  </div>
</template>

<script>
import { ref, nextTick, watch } from '@common/utils/vueTools'
import { userLists } from '@renderer/store/list/state'
import { createUserList } from '@renderer/store/list/action'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@root/lang'
import PlaylistIdentity from './PlaylistIdentity.vue'

export default {
  components: { PlaylistIdentity },
  props: {
    lists: { type: Array, required: true },
    disabled: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    showStatus: { type: Boolean, default: true },
  },
  emits: ['select', 'creating'],
  setup(props, { emit }) {
    const t = useI18n()
    const input = ref(null)
    const editing = ref(false)
    const name = ref('')
    const error = ref('')
    const saving = ref(false)
    const cancelEditing = () => {
      editing.value = false
      name.value = ''
      error.value = ''
    }
    const startEditing = () => {
      editing.value = true
      void nextTick(() => input.value?.focus())
    }
    const saveList = async() => {
      const listName = name.value.trim()
      if (props.disabled || saving.value || !listName) return
      saving.value = true
      emit('creating', true)
      error.value = ''
      try {
        if (userLists.some(list => list.name == listName) && !(await dialog.confirm(t('list_duplicate_tip')))) return
        await createUserList({ name: listName })
        cancelEditing()
      } catch {
        error.value = t('list_add__create_failed')
      } finally {
        saving.value = false
        emit('creating', false)
      }
    }
    watch(() => props.active, active => { if (!active) cancelEditing() })
    return { input, editing, name, error, saving, startEditing, cancelEditing, saveList }
  },
}
</script>

<style lang="less" module>
.main { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr));
  align-content: start;
  gap: 10px;
  padding: 0 20px 20px;
  min-height: 0;
}
.target {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
  min-height: 58px;
  border-radius: 12px !important;
  padding: 9px 12px !important;
  gap: 10px;
  color: var(--color-font);
  background: rgb(from var(--color-font) r g b / .025);
  box-shadow: none;
  border: 1px solid rgb(from var(--color-font) r g b / .08);
  &:hover:not(:disabled) { background: rgb(from var(--color-font) r g b / .055); box-shadow: none; transform: none; }
  &:active:not(:disabled) { transform: scale(.985); }
}
.name { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { flex: none; font-size: 11px; font-weight: normal; white-space: nowrap; color: var(--color-font-label); }
.exists:disabled { opacity: 1; cursor: default; }
.exists .hint { color: var(--color-primary); }
.newList {
  flex-direction: row;
  justify-content: flex-start;
  border: 1px dashed var(--color-primary-alpha-700);
  box-shadow: none;
  svg { width: 16px; height: 16px; flex: none; }
}
.editor {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  input { flex: 1; min-width: min(230px, 100%); box-sizing: border-box; }
}
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-left: auto; }
.status, .error { flex: none; margin: 0; padding: 0 16px 14px; font-size: 12px; line-height: 1.5; }
.status { color: var(--color-font); }
.error { color: var(--color-primary); }
</style>
