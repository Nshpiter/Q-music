<template>
  <div :class="$style.container">
    <base-btn min :disabled="disabled || busy" @click="verify">{{ $t(busy ? 'kugou_verify_working' : 'kugou_verify_action') }}</base-btn>
    <p v-if="status" role="status">{{ $t('kugou_verify_' + status) }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { verifyKugouAccess } from '@renderer/utils/ipc'
const props = defineProps({ disabled: Boolean })
const emit = defineEmits(['verified', 'busy'])
const busy = ref(false)
const status = ref('')
const verify = async() => {
  if (props.disabled || busy.value) return
  busy.value = true
  status.value = ''
  emit('busy', true)
  try {
    status.value = await verifyKugouAccess()
    if (status.value == 'available') emit('verified')
  } catch { status.value = 'verification_failed' } finally { busy.value = false; emit('busy', false) }
}
</script>

<style lang="less" module>
.container { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0; }
.container p { font-size: 12px; line-height: 1.6; color: var(--color-font-label); }
</style>
