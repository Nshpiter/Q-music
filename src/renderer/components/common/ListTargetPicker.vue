<template>
  <div :class="$style.main" :aria-busy="disabled || saving">
    <div class="scroll" :class="$style.grid">
      <base-btn
        v-for="item in lists" :key="item.id" type="button" :class="$style.target"
        :aria-label="item.isExist ? `${item.name}，${$t('list_add__exists')}` : item.name"
        :disabled="disabled || saving || item.isExist" @click="$emit('select', item.id)"
      >
        <span :class="$style.name">{{ item.name }}</span>
        <span v-if="item.isExist" :class="$style.hint">{{ $t('list_add__exists') }}</span>
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
    <p v-if="disabled || saving" :class="$style.status" role="status">{{ $t('list_add__saving') }}</p>
  </div>
</template>

<script>
import { ref, nextTick, watch } from '@common/utils/vueTools'
import { userLists } from '@renderer/store/list/state'
import { createUserList } from '@renderer/store/list/action'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@root/lang'

export default {
  props: {
    lists: { type: Array, required: true },
    disabled: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
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
  grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
  align-content: start;
  gap: 10px;
  padding: 0 16px 16px;
  min-height: 0;
}
.target {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 0;
  min-height: 44px;
  padding: 9px 12px !important;
  gap: 4px;
}
.name { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint { font-size: 11px; font-weight: normal; }
.newList {
  flex-direction: row;
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
  input { flex: 1; min-width: min(160px, 100%); box-sizing: border-box; }
}
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-left: auto; }
.status, .error { flex: none; margin: 0; padding: 0 16px 14px; font-size: 12px; line-height: 1.5; }
.status { color: var(--color-font); }
.error { color: var(--color-primary); }
</style>
