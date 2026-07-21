<template>
  <div :class="[$style.progress, className]">
    <div :class="[$style.progressBar, $style.progressBar2, {[$style.barTransition]: isActiveTransition}]" :style="{ transform: `scaleX(${progress || 0})` }" @transitionend="handleTransitionEnd" />
    <div v-show="dragging" :class="[$style.progressBar, $style.progressBar3]" :style="{ transform: `scaleX(${dragProgress || 0})` }" />
  </div>
  <div ref="dom_progress" :class="[$style.progressMask, { [$style.dragging]: dragging }]" @mousedown="handleMsDown">
    <div :class="$style.knob" :style="{ left: `${(dragging ? dragProgress : progress || 0) * 100}%` }" />
  </div>
</template>

<script>
import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { playProgress } from '@renderer/store/player/playProgress'

export default {
  props: {
    className: {
      type: String,
      default: '',
    },
    progress: {
      type: Number,
      required: true,
    },
    isActiveTransition: {
      type: Boolean,
      required: true,
    },
    handleTransitionEnd: {
      type: Function,
      required: true,
    },
  },
  setup(props) {
    const msEvent = {
      isMsDown: false,
      msDownX: 0,
      msDownProgress: 0,
    }
    const dom_progress = ref(null)
    const dragging = ref(false)
    const dragProgress = ref(0)

    const handleMsDown = event => {
      msEvent.isMsDown = true
      msEvent.msDownX = event.clientX

      let val = event.offsetX / dom_progress.value.clientWidth
      if (val < 0) val = 0
      if (val > 1) val = 1

      dragProgress.value = msEvent.msDownProgress = val
    }
    const handleMsUp = () => {
      if (msEvent.isMsDown) setProgress(dragProgress.value * playProgress.maxPlayTime)
      msEvent.isMsDown = false
      dragging.value = false
    }
    const handleMsMove = event => {
      if (!msEvent.isMsDown) return
      dragging.value ||= true

      let progress = msEvent.msDownProgress + (event.clientX - msEvent.msDownX) / dom_progress.value.clientWidth
      if (progress > 1) progress = 1
      else if (progress < 0) progress = 0
      dragProgress.value = progress
    }

    document.addEventListener('mousemove', handleMsMove)
    document.addEventListener('mouseup', handleMsUp)
    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', handleMsMove)
      document.removeEventListener('mouseup', handleMsUp)
    })

    const setProgress = num => {
      window.app_event.setProgress(num)
    }

    // const handleSetProgress = event => {
    //   // setProgress(event.offsetX / dom_progress.value.clientWidth * playProgress.maxPlayTime)
    // }

    return {
      dom_progress,
      // handleSetProgress,
      dragging,
      dragProgress,
      handleMsDown,
    }
  },
}
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
