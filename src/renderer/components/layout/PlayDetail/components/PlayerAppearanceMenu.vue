<template>
  <teleport to="#root">
    <section v-if="modelValue" ref="menuRef" :class="[$style.container, { [$style.dark]: dark }]" :style="menuStyle" role="dialog" :aria-label="$t('play_detail_appearance_menu')" @click.stop>
      <div :class="$style.header">
        <div :class="$style.title">{{ $t('play_detail_appearance_menu') }}</div>
        <div :class="$style.hint">{{ $t('play_detail_appearance_hint') }}</div>
      </div>
      <div :class="$style.group">
        <div :class="$style.groupTitle">{{ $t('setting__play_detail_layout') }}</div>
        <div :class="$style.options"><button v-for="option in layoutOptions" :key="option.value" type="button" :class="[$style.option, { [$style.active]: appSetting['playDetail.style.layout'] == option.value }]" @click="selectLayout(option.value)">{{ option.label }}</button></div>
      </div>
      <div :class="$style.group">
        <div :class="$style.groupTitle">{{ $t('setting__play_detail_visualization') }}</div>
        <div :class="$style.options"><button v-for="option in visualizationOptions" :key="option.value" type="button" :class="[$style.option, { [$style.active]: option.active }]" @click="selectVisualization(option.value)">{{ option.label }}</button></div>
      </div>
    </section>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting } from '@renderer/store/setting'

const props = defineProps({ modelValue: Boolean, dark: Boolean, anchor: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue', 'select-layout', 'select-visualization'])
const t = useI18n()
const menuRef = ref(null)
const menuStyle = computed(() => {
  const width = 304
  if (!props.anchor) return { left: `calc(50vw - ${width / 2}px)`, bottom: '84px' }
  const left = Math.max(12, Math.min(props.anchor.x - width / 2, window.innerWidth - width - 12))
  return { left: `${left}px`, bottom: `${Math.max(12, window.innerHeight - props.anchor.y + 10)}px` }
})
const layoutOptions = computed(() => [
  { value: 'classic', label: t('setting__play_detail_layout_classic') },
  { value: 'immersive', label: t('setting__play_detail_layout_immersive') },
])
const visualizationOptions = computed(() => [
  { value: 'off', label: t('play_detail_visualization_off'), active: !appSetting['player.audioVisualization'] },
  { value: 'ambient', label: t('setting__play_detail_visualization_ambient'), active: appSetting['player.audioVisualization'] && appSetting['player.audioVisualizationStyle'] == 'ambient' },
  { value: 'ribbon', label: t('setting__play_detail_visualization_ribbon'), active: appSetting['player.audioVisualization'] && appSetting['player.audioVisualizationStyle'] == 'ribbon' },
  { value: 'spectrum', label: t('setting__play_detail_visualization_spectrum'), active: appSetting['player.audioVisualization'] && appSetting['player.audioVisualizationStyle'] == 'spectrum' },
])
const close = () => { emit('update:modelValue', false) }
const handleOutside = event => { if (props.modelValue && !menuRef.value?.contains(event.target)) close() }
onMounted(() => { document.addEventListener('click', handleOutside) })
onBeforeUnmount(() => { document.removeEventListener('click', handleOutside) })
const selectLayout = value => { emit('select-layout', value) }
const selectVisualization = value => { emit('select-visualization', value) }
</script>

<style lang="less" module>
.container { position: fixed; z-index: 80; width: 304px; padding: 15px; box-sizing: border-box; color: var(--color-font); border: 1px solid rgb(from var(--color-font) r g b / .11); border-radius: 17px; background: rgb(from var(--color-content-background) r g b / .94); box-shadow: 0 18px 50px rgba(20,28,32,.2), inset 0 1px 0 rgba(255,255,255,.72); backdrop-filter: blur(24px) saturate(1.18); animation: popIn .16s cubic-bezier(.2,.8,.2,1); transform-origin: 50% 100%; }
.dark { color: rgba(255,255,255,.94); border-color: rgba(255,255,255,.12); background: rgba(24,29,32,.92); box-shadow: 0 22px 54px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08); }
.header { padding: 1px 2px 11px; }
.title { font-size: 14px; font-weight: 720; }
.hint { margin-top: 3px; font-size: 10px; opacity: .45; }
.group { padding-top: 10px; border-top: 1px solid rgb(from currentColor r g b / .09); & + & { margin-top: 10px; } }
.groupTitle { padding: 0 2px 7px; font-size: 11px; font-weight: 650; opacity: .52; }
.options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.option { min-width: 0; height: 34px; padding: 0 8px; font-size: 12px; font-weight: 650; color: currentColor; border: 1px solid rgb(from currentColor r g b / .08); border-radius: 10px; background: rgb(from currentColor r g b / .045); cursor: pointer; transition: .14s ease; &:hover { background: rgb(from currentColor r g b / .1); } }
.active { color: var(--color-primary); border-color: var(--color-primary-alpha-600); background: var(--color-primary-alpha-800); }
.dark .active { color: #fff; border-color: rgba(255,255,255,.25); background: rgba(255,255,255,.16); }
@keyframes popIn { from { opacity: 0; transform: translateY(7px) scale(.97); } to { opacity: 1; transform: none; } }
</style>
