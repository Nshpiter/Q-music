<template>
  <details :class="$style.panel">
    <summary>{{ layout }} · {{ $t('layout_options') }}</summary>
    <label>{{ $t('layout_accent') }} <input type="color" :value="options.accent || '#738577'" @input="write({ accent: $event.target.value })"></label>
    <label>{{ $t('layout_bar_radius') }} <input type="range" min="0" max="36" :value="options.radius ?? 24" @input="write({ radius: Number($event.target.value) })"></label>
    <label><input type="checkbox" :checked="options.docked" @change="write({ docked: $event.target.checked })">{{ $t('layout_dock') }}</label>
    <template v-if="layout === 'MoTheme'">
      <label><input type="checkbox" :checked="options.spectrumBar !== false" @change="write({ spectrumBar: $event.target.checked })">{{ $t('layout_spectrum_bar') }}</label>
      <label>{{ $t('layout_bar_blur') }} <input type="range" min="0" max="36" :value="options.barBlur ?? 12" @input="write({ barBlur: Number($event.target.value) })"></label>
      <label>{{ $t('layout_bar_saturation') }} <input type="range" min="50" max="200" :value="options.barSaturation ?? 120" @input="write({ barSaturation: Number($event.target.value) })"></label>
    </template>
    <template v-if="layout === 'Transmission'">
      <label>{{ $t('layout_background_blur') }} <input type="range" min="0" max="32" :value="options.backgroundBlur ?? 0" @input="write({ backgroundBlur: Number($event.target.value) })"></label>
      <label><input type="checkbox" :checked="options.vinyl" @change="write({ vinyl: $event.target.checked })">{{ $t('layout_vinyl') }}</label>
    </template>
    <div>
      <base-btn min @click="pick">{{ $t('setting__basic_glass_bg_select') }}</base-btn>
      <small v-if="options.background">{{ basename(options.background) }}</small>
      <base-btn v-if="options.background" min @click="write({ background: '' })">{{ $t('setting__basic_glass_bg_clear') }}</base-btn>
    </div>
    <base-btn v-if="Object.keys(options).length" min @click="reset">{{ $t('player__playback_rate_reset_btn') }}</base-btn>
  </details>
</template>
<script setup>
import { basename } from 'node:path'
import { computed, toRaw } from 'vue'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { showSelectDialog } from '@renderer/utils/ipc'
const props = defineProps({ layout: { type: String, required: true } })
const sets = computed(() => appSetting['theme.layoutOptions'] ?? {})
const options = computed(() => sets.value[props.layout] ?? {})
const write = change => {
  updateSetting({ 'theme.layoutOptions': { ...toRaw(sets.value), [props.layout]: { ...options.value, ...change } } })
}
const reset = () => {
  const { [props.layout]: removed, ...rest } = toRaw(sets.value)
  if (removed) updateSetting({ 'theme.layoutOptions': rest })
}
const pick = async() => {
  const layout = props.layout
  const result = await showSelectDialog({ properties: ['openFile'], filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'avif'] }] })
  if (props.layout === layout && !result.canceled && result.filePaths[0]) write({ background: result.filePaths[0] })
}
</script>
<style module>
.panel { margin: 8px 0; }
.panel label, .panel div { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0; }
</style>
