<template>
  <teleport to="#root">
    <section v-if="modelValue" ref="menuRef" :class="[$style.container, { [$style.dark]: dark }]" :style="menuStyle" role="dialog" :aria-label="$t('play_detail_appearance_menu')" @click.stop>
      <header :class="$style.header">
        <strong>{{ $t('play_detail_appearance_menu') }}</strong>
      </header>
      <div :class="$style.body">
        <div :class="$style.group">
          <div :class="$style.groupTitle">{{ $t('setting__play_detail_layout') }}</div>
          <div :class="$style.options"><button v-for="option in layoutOptions" :key="option.value" type="button" :class="[$style.option, { [$style.active]: appSetting['playDetail.style.layout'] == option.value }]" :aria-pressed="appSetting['playDetail.style.layout'] == option.value" @click="selectLayout(option.value)">{{ option.label }}</button></div>
        </div>
        <div :class="$style.group">
          <div :class="$style.groupTitle">{{ $t('lyric_arrangement') }}</div>
          <LyricArrangement />
        </div>
        <div :class="$style.group">
          <div :class="$style.groupTitle">{{ $t('play_detail_word_motion') }}</div>
          <div :class="$style.options">
            <button v-for="enabled in [false, true]" :key="String(enabled)" type="button" :class="[$style.option, { [$style.active]: appSetting['playDetail.wordMotion'] === enabled }]" :aria-pressed="appSetting['playDetail.wordMotion'] === enabled" @click="updateSetting({ 'playDetail.wordMotion': enabled })">{{ $t(enabled ? 'play_detail_word_motion_lift' : 'play_detail_word_motion_original') }}</button>
          </div>
        </div>
        <div :class="$style.group">
          <div :class="$style.groupTitle">{{ $t('setting__play_detail_visualization') }}</div>
          <div :class="$style.options"><button v-for="option in visualizationOptions" :key="option.value" type="button" :class="[$style.option, { [$style.active]: option.active }]" :aria-pressed="option.active" @click="selectVisualization(option.value)">{{ option.label }}</button></div>
        </div>
        <details :class="$style.windows" @toggle="revealWindows">
          <summary>
            {{ $t('play_detail_floating_window') }}
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
          </summary>
          <button type="button" @click="openMini(false)">{{ $t('mini_player') }}</button>
          <button type="button" @click="openMini(true)">{{ $t('lyric_capsule') }}</button>
        </details>
      </div>
    </section>
  </teleport>
</template>

<script setup>
import useMenuOutsideClick from '@renderer/utils/compositions/useMenuOutsideClick'
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import LyricArrangement from '@renderer/components/common/LyricArrangement.vue'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { openMiniPlayer } from '@renderer/utils/ipc'
import { setDisableAutoPauseBySource } from '@renderer/core/lyric'

const props = defineProps({ modelValue: Boolean, dark: Boolean, anchor: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue', 'select-layout', 'select-visualization'])
const t = useI18n()
const menuRef = ref(null)
const viewport = ref({ width: window.innerWidth, height: window.innerHeight })
const menuStyle = computed(() => {
  const { width: viewportWidth, height: viewportHeight } = viewport.value
  const width = Math.min(304, Math.max(1, viewportWidth - 24))
  const left = props.anchor
    ? Math.max(12, Math.min(props.anchor.x - width / 2, viewportWidth - width - 12))
    : Math.max(12, (viewportWidth - width) / 2)
  const preferredBottom = props.anchor ? viewportHeight - props.anchor.y + 10 : 84
  const bottom = Math.max(12, Math.min(preferredBottom, viewportHeight - 160))
  const maxHeight = Math.max(1, viewportHeight - bottom - 12)
  return { left: `${left}px`, bottom: `${bottom}px`, width: `${width}px`, maxHeight: `${maxHeight}px` }
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
const revealWindows = ({ currentTarget }) => {
  if (currentTarget.open) currentTarget.scrollIntoView({ block: 'nearest' })
}
let opener
watch(() => props.modelValue, visible => {
  if (!visible) return
  opener = document.activeElement
  menuRef.value?.querySelector('button[aria-pressed="true"]')?.focus({ preventScroll: true })
}, { flush: 'post' })
const openMini = async(capsule) => {
  close()
  const source = capsule ? 'lyricCapsule' : 'miniPlayer'
  setDisableAutoPauseBySource(true, source)
  try {
    await openMiniPlayer({ title: t(capsule ? 'lyric_capsule' : 'mini_player'), play: t('player__play'), pause: t('player__pause'), prev: t('player__prev'), next: t('player__next'), minimize: t('theme_edit_modal__min_btn'), close: t('close') }, capsule)
  } finally {
    setDisableAutoPauseBySource(false, source)
  }
}
useMenuOutsideClick(menuRef, () => null, close)
const handleKeydown = event => {
  if (!props.modelValue || event.key != 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  close()
  props.anchor?.trigger?.focus()
  opener?.focus({ preventScroll: true })
}
const handleResize = () => { viewport.value = { width: window.innerWidth, height: window.innerHeight } }
onMounted(() => {
  document.addEventListener('keydown', handleKeydown, true)
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown, true)
  window.removeEventListener('resize', handleResize)
})
const selectLayout = value => { emit('select-layout', value) }
const selectVisualization = value => { emit('select-visualization', value) }
</script>

<style lang="less" module>
.container { position: fixed; z-index: 80; display: flex; flex-direction: column; overflow: hidden; max-width: calc(100vw - 24px); box-sizing: border-box; color: var(--color-font); border: 1px solid rgb(from var(--color-font) r g b / .11); border-radius: 15px; background: rgb(from var(--color-content-background) r g b / .96); box-shadow: 0 12px 36px rgba(20,28,32,.2); backdrop-filter: blur(16px); animation: popIn .16s cubic-bezier(.2,.8,.2,1); transform-origin: 50% 100%; }
.dark { color: rgba(255,255,255,.94); border-color: rgba(255,255,255,.12); background: rgba(24,29,32,.92); box-shadow: 0 22px 54px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08); }
.header { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; font-size: 14px; border-bottom: 1px solid rgb(from currentColor r g b / .09); }
.body {
  overflow-y: auto; min-height: 0; overscroll-behavior: contain; padding: 11px 14px 14px;
  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-button { display: none; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgb(from currentColor r g b / .26); border-radius: 8px; }
}
.group + .group { margin-top: 12px; }
.groupTitle { padding: 0 2px 5px; font-size: 11px; font-weight: 650; opacity: .7; }
.windows {
  margin-top: 12px;
  padding-top: 4px;
  border-top: 1px solid rgb(from currentColor r g b / .1);
  summary, button {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 30px;
    box-sizing: border-box;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    &:hover { background: rgb(from currentColor r g b / .06); }
    &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
  }
  summary {
    justify-content: space-between;
    padding: 0 6px;
    &::-webkit-details-marker { display: none; }
    svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; }
  }
  &[open] summary svg { transform: rotate(90deg); }
  button { padding: 0 14px; }
}
.options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.option { min-width: 0; min-height: 30px; padding: 3px 8px; font: inherit; font-size: 12px; font-weight: 550; color: currentColor; border: 1px solid rgb(from currentColor r g b / .08); border-radius: 8px; background: rgb(from currentColor r g b / .045); cursor: pointer; &:hover { background: rgb(from currentColor r g b / .1); } }
.container button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
.active { color: var(--color-primary); border-color: var(--color-primary-alpha-600); background: var(--color-primary-alpha-800); }
.dark .active { color: #fff; border-color: rgba(255,255,255,.25); background: rgba(255,255,255,.16); }
@keyframes popIn { from { opacity: 0; transform: translateY(7px) scale(.97); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .container { animation: none; } }
</style>
