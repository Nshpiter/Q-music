<template>
  <div :class="[$style.progress, className]">
    <div :class="[$style.progressBar, $style.progressBar2, {[$style.barTransition]: isActiveTransition}]" :style="{ transform: `scaleX(${progress || 0})` }" @transitionend="handleTransitionEnd" />
    <div v-show="dragging" :class="[$style.progressBar, $style.progressBar3]" :style="{ transform: `scaleX(${dragProgress || 0})` }" />
  </div>
  <div
    ref="slider" :class="[$style.progressMask, { [$style.dragging]: dragging }]"
    role="slider" :tabindex="canSeek ? 0 : -1" :aria-disabled="!canSeek" :aria-label="$t('player__seek')" ignore-tip
    aria-valuemin="0" :aria-valuemax="canSeek ? duration : 0" :aria-valuenow="canSeek ? Math.round(playProgress.nowPlayTime) : 0" :aria-valuetext="playProgress.nowPlayTimeStr"
    @pointerenter="preview" @pointermove="preview" @pointerleave="leave" @pointerdown="startDrag" @pointerup="finishDrag"
    @pointercancel="reset" @lostpointercapture="reset" @keydown="seekWithKey"
  >
    <div :class="$style.knob" :style="{ left: `${(dragging ? dragProgress : progress || 0) * 100}%` }" />
  </div>
  <teleport to="#root">
    <div v-if="point && canSeek" :class="$style.preview" :style="{ '--seek-x': point.x + 'px', top: point.y + 'px' }" aria-hidden="true">
      <span>{{ formatPlayTime2(previewTime) }}</span>
      <strong v-if="previewLyric">{{ previewLyric }}</strong>
    </div>
  </teleport>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { formatPlayTime2 } from '@common/utils/common'
import { getLyricAtTime } from '@renderer/store/player/lyric'
import { playProgress } from '@renderer/store/player/playProgress'
import { musicInfo, isShowPlayerDetail } from '@renderer/store/player/state'

defineProps({
  className: { type: String, default: '' },
  progress: { type: Number, required: true },
  isActiveTransition: { type: Boolean, required: true },
  handleTransitionEnd: { type: Function, required: true },
})
const slider = ref(null)
const pointer = ref(null)
const point = ref(null)
const dragProgress = ref(0)
const dragging = computed(() => pointer.value != null)
const duration = computed(() => playProgress.maxPlayTime)
const canSeek = computed(() => !!musicInfo.id && Number.isFinite(duration.value) && duration.value > 0)
const previewTime = computed(() => dragProgress.value * duration.value)
const previewLyric = computed(() => musicInfo.lrc ? getLyricAtTime(previewTime.value) : '')

const preview = event => {
  if (!canSeek.value || !event.isPrimary) return
  const rect = slider.value.getBoundingClientRect()
  if (!rect.width) return
  const x = Math.max(rect.left, Math.min(rect.right, event.clientX))
  dragProgress.value = (x - rect.left) / rect.width
  point.value = { x, y: rect.top - 8 }
}
const leave = () => {
  if (!dragging.value) point.value = null
}
const reset = () => {
  if (pointer.value != null && slider.value?.hasPointerCapture(pointer.value)) slider.value.releasePointerCapture(pointer.value)
  pointer.value = null
  point.value = null
}
const startDrag = event => {
  if (!canSeek.value || event.button != 0 || !event.isPrimary) return
  slider.value.setPointerCapture(event.pointerId)
  pointer.value = event.pointerId
  preview(event)
}
const finishDrag = event => {
  if (event.pointerId !== pointer.value) return
  preview(event)
  if (canSeek.value) window.app_event.setProgress(previewTime.value)
  reset()
}
const seekWithKey = event => {
  if (!canSeek.value || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  let time = playProgress.nowPlayTime
  switch (event.key) {
    case 'ArrowLeft': time -= 5; break
    case 'ArrowRight': time += 5; break
    case 'Home': time = 0; break
    case 'End': time = duration.value; break
    default:
      if (!/^[0-9]$/.test(event.key)) return
      time = duration.value * Number(event.key) / 10
  }
  event.preventDefault()
  event.stopPropagation()
  reset()
  window.app_event.setProgress(Math.max(0, Math.min(duration.value, time)))
}
watch([() => musicInfo.id, isShowPlayerDetail, canSeek], reset)
onMounted(() => { window.addEventListener('resize', reset) })
onBeforeUnmount(() => { window.removeEventListener('resize', reset) })
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.progress {
  width: 100%;
  height: 5px;
  overflow: hidden;
  transition: @transition-normal;
  transition-property: background-color;
  background-color: var(--q-progress-track-color, var(--color-primary-light-100-alpha-800));
  // background-color: #f5f5f5;
  position: relative;
  border-radius: 40px;
}
.progressMask {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  touch-action: none;
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 8px; }

  // 拖拽圆点：平时隐藏，hover/拖拽时弹出，指明进度条可拖
  .knob {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%) scale(0);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 6px rgba(0, 0, 0, .35), inset 0 0 0 1px rgba(0, 0, 0, .05);
    pointer-events: none;
    transition: transform .18s ease, left .2s ease-out;
  }

  &:hover .knob {
    transform: translate(-50%, -50%) scale(1);
  }

  &.dragging .knob {
    transform: translate(-50%, -50%) scale(1.15);
    transition: transform .18s ease; // 拖拽时位置跟手，不做 left 过渡
  }
}
.preview {
  position: fixed;
  left: clamp(min(136px, 50vw), var(--seek-x), max(50vw, calc(100vw - 136px)));
  z-index: var(--q-z-float);
  pointer-events: none;
  transform: translate(-50%, -100%);
  max-width: min(244px, calc(100vw - 20px));
  width: max-content;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--color-content-background);
  color: var(--color-font);
  border: 1px solid var(--q-outline);
  box-shadow: 0 3px 12px rgba(0, 0, 0, .16);
  display: flex;
  gap: 7px;
  align-items: baseline;
  font-size: 12px;
  line-height: 1.45;
  span { flex: none; font-variant-numeric: tabular-nums; }
  strong { .mixin-ellipsis-1(); font-weight: 550; }
}
.progressBar {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0;
}
.progressBar1 {
  background-color: var(--color-primary-light-100-alpha-600);
}

.progressBar2 {
  background-image: var(--q-progress-fill, none);
  background-color: var(--q-progress-bar-color, var(--color-primary-light-100-alpha-400));
  will-change: transform;
}

.progressBar3 {
  background-color: var(--q-progress-drag-color, var(--color-primary-light-100-alpha-200));
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
  opacity: 0.5;
}

.barTransition {
  transition-property: transform;
  transition-timing-function: ease-out;
  transition-duration: 0.2s;
}

</style>
