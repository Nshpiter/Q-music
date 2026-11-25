<template>
  <details :class="$style.panel">
    <summary>{{ layout }} · {{ $t('layout_options') }}</summary>
    <div :class="$style.grid">
      <div :class="$style.row">
        <span :class="$style.label">{{ $t('layout_accent') }}</span>
        <input type="color" :aria-label="$t('layout_accent')" :value="options.accent || '#738577'" @input="write({ accent: $event.target.value })">
        <span :class="$style.val">{{ options.accent || '#738577' }}</span>
      </div>
      <div :class="$style.row">
        <span :class="$style.label">{{ $t('layout_bar_radius') }}</span>
        <input type="range" min="0" max="36" :aria-label="$t('layout_bar_radius')" :value="options.radius ?? 24" @input="write({ radius: Number($event.target.value) })">
        <span :class="$style.val">{{ options.radius ?? 24 }} px</span>
      </div>
      <base-checkbox :id="`layout_dock_${layout}`" :model-value="!!options.docked" :label="$t('layout_dock')" @update:model-value="write({ docked: $event })" />
      <template v-if="layout === 'MoTheme'">
        <base-checkbox :id="`layout_spectrum_${layout}`" :model-value="options.spectrumBar !== false" :label="$t('layout_spectrum_bar')" @update:model-value="write({ spectrumBar: $event })" />
        <div :class="$style.row">
          <span :class="$style.label">{{ $t('layout_bar_blur') }}</span>
          <input type="range" min="0" max="36" :aria-label="$t('layout_bar_blur')" :value="options.barBlur ?? 12" @input="write({ barBlur: Number($event.target.value) })">
          <span :class="$style.val">{{ options.barBlur ?? 12 }} px</span>
        </div>
        <div :class="$style.row">
          <span :class="$style.label">{{ $t('layout_bar_saturation') }}</span>
          <input type="range" min="50" max="200" :aria-label="$t('layout_bar_saturation')" :value="options.barSaturation ?? 120" @input="write({ barSaturation: Number($event.target.value) })">
          <span :class="$style.val">{{ options.barSaturation ?? 120 }}%</span>
        </div>
      </template>
      <template v-if="layout === 'Transmission'">
        <div :class="$style.row">
          <span :class="$style.label">{{ $t('layout_background_blur') }}</span>
          <input type="range" min="0" max="32" :aria-label="$t('layout_background_blur')" :value="options.backgroundBlur ?? 0" @input="write({ backgroundBlur: Number($event.target.value) })">
          <span :class="$style.val">{{ options.backgroundBlur ?? 0 }} px</span>
        </div>
        <base-checkbox :id="`layout_vinyl_${layout}`" :model-value="!!options.vinyl" :label="$t('layout_vinyl')" @update:model-value="write({ vinyl: $event })" />
      </template>
      <div :class="$style.actions">
        <base-btn min @click="pick">{{ $t('setting__basic_glass_bg_select') }}</base-btn>
        <span v-if="options.background" :class="$style.fileName">{{ basename(options.background) }}</span>
        <base-btn v-if="options.background" min outline @click="write({ background: '' })">{{ $t('setting__basic_glass_bg_clear') }}</base-btn>
        <base-btn v-if="Object.keys(options).length" min outline @click="reset">{{ $t('player__playback_rate_reset_btn') }}</base-btn>
      </div>
    </div>
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
.panel { margin-top: 12px; max-width: 560px; }
.grid { display: grid; gap: 10px; padding-top: 8px; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 13px; }
.label { min-width: 6.5em; color: var(--color-font); }
.val { min-width: 4em; font-size: 12px; color: var(--color-primary-font); font-variant-numeric: tabular-nums; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 2px; }
.fileName { font-size: 12px; color: var(--color-font-label); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
