<template>
  <teleport to="#root">
    <div ref="domMenu" :class="[$style.container, { [$style.dark]: dark }]" :style="menuStyles" :aria-hidden="!modelValue">
      <div :class="$style.header">
        <div :class="$style.title">{{ $t('player__quality_title') }}</div>
        <div :class="$style.hint">{{ $t('player__quality_hint') }}</div>
      </div>
      <button
        v-for="option in options" :key="option.value" type="button"
        :class="[$style.option, { [$style.active]: appSetting['player.playQuality'] == option.value }]"
        @click="selectQuality(option.value)"
      >
        <span :class="$style.optionLabel">{{ option.label }}</span>
        <span :class="$style.optionMeta">{{ option.meta }}</span>
        <svg v-if="appSetting['player.playQuality'] == option.value" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5l4 4L19 7" />
        </svg>
      </button>
    </div>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting } from '@renderer/store/setting'

const props = defineProps({
  modelValue: Boolean,
  xy: { type: Object, required: true },
  dark: Boolean,
})
const emit = defineEmits(['update:modelValue', 'select'])
const t = useI18n()
const domMenu = ref(null)
const options = computed(() => [
  { value: '128k', label: t('player__quality_standard'), meta: '128 kbps' },
  { value: '320k', label: t('player__quality_high'), meta: '320 kbps' },
  { value: 'flac', label: t('player__quality_lossless'), meta: 'FLAC' },
  { value: 'flac24bit', label: t('player__quality_hires'), meta: '24-bit' },
])
const menuStyles = reactive({
  left: '8px',
  top: '8px',
  opacity: 0,
  pointerEvents: 'none',
  transform: 'scale(.96) translateY(6px)',
})
const placeAboveAnchor = () => {
  const menu = domMenu.value
  if (!menu) return
  const gap = 10
  const viewportGap = 8
  const left = Math.min(Math.max(props.xy.x - menu.clientWidth, viewportGap), window.innerWidth - menu.clientWidth - viewportGap)
  const top = Math.max(props.xy.y - menu.clientHeight - gap, viewportGap)
  menuStyles.left = `${left}px`
  menuStyles.top = `${top}px`
}
watch(() => [props.modelValue, props.xy], ([visible]) => {
  menuStyles.opacity = visible ? 1 : 0
  menuStyles.pointerEvents = visible ? 'auto' : 'none'
  menuStyles.transform = visible ? 'scale(1) translateY(0)' : 'scale(.96) translateY(6px)'
  if (visible) void nextTick(placeAboveAnchor)
}, { deep: true })
const handleDocumentClick = event => {
  if (!props.modelValue || domMenu.value?.contains(event.target)) return
  emit('update:modelValue', false)
}
const handleResize = () => {
  if (props.modelValue) placeAboveAnchor()
}
onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', handleResize)
})
const selectQuality = value => {
  emit('select', value)
  emit('update:modelValue', false)
}
</script>

<style lang="less" module>
.container {
  position: fixed;
  z-index: 31;
  width: 206px;
  padding: 9px;
  color: var(--color-font);
  border: 1px solid rgb(from var(--color-font) r g b / .1);
  border-radius: 16px;
  background: rgb(from var(--color-content-background) r g b / .88);
  box-shadow: 0 20px 54px rgba(20, 28, 32, .2), inset 0 1px 0 rgba(255, 255, 255, .72);
  backdrop-filter: blur(28px) saturate(1.3);
  transform-origin: bottom right;
  transition: .18s cubic-bezier(.2, .8, .2, 1);
  transition-property: transform, opacity, top, left;
  box-sizing: border-box;
}
.dark {
  color: rgba(255, 255, 255, .92);
  border-color: rgba(255, 255, 255, .12);
  background: rgba(24, 29, 32, .82);
  box-shadow: 0 24px 64px rgba(0, 0, 0, .38), inset 0 1px 0 rgba(255, 255, 255, .1);
}
.header { padding: 2px 5px 8px; }
.title { font-size: 14px; font-weight: 700; }
.hint { margin-top: 2px; font-size: 10px; opacity: .48; }
.option {
  position: relative;
  width: 100%;
  height: 38px;
  padding: 0 34px 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: currentColor;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color .16s ease, transform .16s ease;

  &:hover { background: rgb(from currentColor r g b / .08); }
  &:active { transform: scale(.985); }
  svg {
    position: absolute;
    right: 10px;
    width: 17px;
    height: 17px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}
.optionLabel { flex: auto; font-size: 12px; font-weight: 600; }
.optionMeta { flex: none; font-size: 10px; opacity: .48; }
.active { color: var(--color-primary); background: var(--color-primary-alpha-800); }
.dark .active { color: #fff; background: rgba(255, 255, 255, .16); }
</style>
