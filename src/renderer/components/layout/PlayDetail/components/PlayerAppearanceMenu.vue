<template>
  <teleport to="#root">
    <div ref="dom_menu" :class="[$style.container, { [$style.dark]: dark }]" :style="menuStyles" :aria-hidden="!modelValue">
      <div :class="$style.header">
        <div :class="$style.title">{{ $t('play_detail_appearance_menu') }}</div>
      </div>
      <div :class="$style.group">
        <div :class="$style.groupTitle">{{ $t('setting__play_detail_layout') }}</div>
        <div :class="$style.options">
          <button
            v-for="option in layoutOptions" :key="option.value" type="button"
            :class="[$style.option, { [$style.active]: appSetting['playDetail.style.layout'] == option.value }]"
            @click="selectLayout(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <div :class="$style.group">
        <div :class="$style.groupTitle">{{ $t('setting__play_detail_visualization') }}</div>
        <div :class="[$style.options, $style.visualOptions]">
          <button
            v-for="option in visualizationOptions" :key="option.value" type="button"
            :class="[$style.option, { [$style.active]: option.active }]"
            @click="selectVisualization(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting } from '@renderer/store/setting'

export default {
  name: 'PlayerAppearanceMenu',
  props: {
    modelValue: Boolean,
    xy: {
      type: Object,
      required: true,
    },
    dark: Boolean,
  },
  emits: ['update:modelValue', 'select-layout', 'select-visualization'],
  setup(props, { emit }) {
    const t = useI18n()
    const visible = computed(() => props.modelValue)
    const location = computed(() => props.xy)
    const layoutOptions = computed(() => [
      { value: 'classic', label: t('setting__play_detail_layout_classic') },
      { value: 'immersive', label: t('setting__play_detail_layout_immersive') },
    ])
    const visualizationOptions = computed(() => [
      { value: 'off', label: t('play_detail_visualization_off'), active: !appSetting['player.audioVisualization'] },
      {
        value: 'ambient',
        label: t('setting__play_detail_visualization_ambient'),
        active: appSetting['player.audioVisualization'] && appSetting['player.audioVisualizationStyle'] == 'ambient',
      },
      {
        value: 'ribbon',
        label: t('setting__play_detail_visualization_ribbon'),
        active: appSetting['player.audioVisualization'] && appSetting['player.audioVisualizationStyle'] == 'ribbon',
      },
      {
        value: 'spectrum',
        label: t('setting__play_detail_visualization_spectrum'),
        active: appSetting['player.audioVisualization'] && appSetting['player.audioVisualizationStyle'] == 'spectrum',
      },
    ])
    const dom_menu = ref(null)
    const menuStyles = reactive({
      left: '8px',
      top: '8px',
      opacity: 0,
      pointerEvents: 'none',
      transform: 'scale(.96) translateY(6px)',
    })
    const placeAboveAnchor = () => {
      const menu = dom_menu.value
      if (!menu) return
      const edgeGap = 10
      const viewportGap = 8
      const left = Math.min(
        Math.max(props.xy.x - menu.clientWidth, viewportGap),
        window.innerWidth - menu.clientWidth - viewportGap,
      )
      const top = Math.max(props.xy.y - menu.clientHeight - edgeGap, viewportGap)
      menuStyles.left = `${left}px`
      menuStyles.top = `${top}px`
    }
    watch([visible, location], ([isVisible]) => {
      menuStyles.opacity = isVisible ? 1 : 0
      menuStyles.pointerEvents = isVisible ? 'auto' : 'none'
      menuStyles.transform = isVisible ? 'scale(1) translateY(0)' : 'scale(.96) translateY(6px)'
      if (isVisible) void nextTick(placeAboveAnchor)
    }, { deep: true })
    const handleDocumentClick = event => {
      if (!visible.value || dom_menu.value?.contains(event.target)) return
      emit('update:modelValue', false)
    }
    const handleResize = () => {
      if (visible.value) placeAboveAnchor()
    }
    onMounted(() => {
      document.addEventListener('click', handleDocumentClick)
      window.addEventListener('resize', handleResize)
    })
    onBeforeUnmount(() => {
      document.removeEventListener('click', handleDocumentClick)
      window.removeEventListener('resize', handleResize)
    })
    const selectLayout = value => emit('select-layout', value)
    const selectVisualization = value => emit('select-visualization', value)

    return {
      appSetting,
      dom_menu,
      menuStyles,
      layoutOptions,
      visualizationOptions,
      selectLayout,
      selectVisualization,
    }
  },
}
</script>

<style lang="less" module>
.container {
  position: fixed;
  z-index: 30;
  width: 264px;
  padding: 10px;
  color: var(--color-font);
  border: 1px solid rgb(from var(--color-font) r g b / .1);
  border-radius: 16px;
  background: rgb(from var(--color-content-background) r g b / .86);
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
  background: rgba(24, 29, 32, .78);
  box-shadow: 0 24px 64px rgba(0, 0, 0, .38), inset 0 1px 0 rgba(255, 255, 255, .1);
}
.header {
  padding: 1px 3px 8px;
}
.title {
  font-size: 14px;
  font-weight: 700;
}
.groupTitle {
  color: currentColor;
  opacity: .52;
}
.group {
  padding: 8px 0 0;
  border-top: 1px solid rgb(from currentColor r g b / .09);

  & + & {
    margin-top: 8px;
  }
}
.groupTitle {
  padding: 0 3px 6px;
  font-size: 11px;
}
.options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}
.visualOptions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.option {
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  color: currentColor;
  border: 1px solid rgb(from currentColor r g b / .09);
  border-radius: 10px;
  background: rgb(from currentColor r g b / .045);
  cursor: pointer;
  transition: .16s ease;
  transition-property: color, background-color, border-color, transform, box-shadow;

  &:hover {
    background: rgb(from currentColor r g b / .09);
    transform: translateY(-1px);
  }
  &:active {
    transform: scale(.98);
  }
  &.active {
    color: var(--color-primary);
    border-color: var(--color-primary-alpha-600);
    background: var(--color-primary-alpha-800);
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-900);
  }
}
.dark .option.active {
  color: #fff;
  border-color: rgba(255, 255, 255, .32);
  background: rgba(255, 255, 255, .18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .12);
}
</style>
