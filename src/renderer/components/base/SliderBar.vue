<template>
  <div :class="[$style.sliderContent, { [$style.disabled]: disabled, [$style.dragging]: dragging }, className]">
    <div :class="[$style.slider]">
      <div ref="dom_sliderBar" :class="$style.sliderBar" :style="{ transform: `scaleX(${(value - min) / (max - min) || 0})` }" />
    </div>
    <div :class="$style.thumb" :style="{ left: `${Math.min(Math.max((value - min) / (max - min) || 0, 0), 1) * 100}%` }" />
    <div :class="$style.sliderMask" @mousedown="handleSliderMsDown" />
  </div>
</template>

<script>
import { ref, onBeforeUnmount } from '@common/utils/vueTools'
// import { player as eventPlayerNames } from '@renderer/event/names'

export default {
  props: {
    className: {
      type: String,
      default: '',
    },
    value: {
      type: Number,
      required: true,
    },
    min: {
      type: Number,
      required: true,
    },
    max: {
      type: Number,
      required: true,
    },
    step: {
      type: Number,
      default: 1,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['change'],
  setup(props, { emit }) {
    const sliderEvent = {
      isMsDown: false,
      msDownX: 0,
      msDownRatio: 0,
    }
    const dom_sliderBar = ref(null)
    const dragging = ref(false)

    const clampValue = val => {
      if (val < props.min) return props.min
      if (val > props.max) return props.max
      return val
    }
    const getSteppedValue = val => {
      const step = props.step > 0 ? props.step : 1
      const stepped = Math.round((val - props.min) / step) * step + props.min
      return clampValue(Number(stepped.toFixed(10)))
    }
    const getSliderWidth = () => dom_sliderBar.value?.clientWidth || 0
    const getRange = () => props.max - props.min
    const emitSteppedValue = rawValue => {
      const value = getSteppedValue(rawValue)
      emit('change', value)
      return value
    }

    const handleSliderMsDown = event => {
      if (props.disabled) return
      const width = getSliderWidth()
      if (!width) return

      sliderEvent.isMsDown = true
      dragging.value = true
      sliderEvent.msDownX = event.clientX

      const rawValue = (event.offsetX / width) * getRange() + props.min
      const value = emitSteppedValue(rawValue)
      sliderEvent.msDownRatio = getRange() === 0 ? 0 : (value - props.min) / getRange()
    }
    const handleSliderMsUp = () => {
      sliderEvent.isMsDown = false
      dragging.value = false
    }
    const handleSliderMsMove = event => {
      if (!sliderEvent.isMsDown || props.disabled) return
      const width = getSliderWidth()
      if (!width) return

      const ratio = sliderEvent.msDownRatio + (event.clientX - sliderEvent.msDownX) / width
      const rawValue = ratio * getRange() + props.min
      emitSteppedValue(rawValue)
    }

    document.addEventListener('mousemove', handleSliderMsMove)
    document.addEventListener('mouseup', handleSliderMsUp)
    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', handleSliderMsMove)
      document.removeEventListener('mouseup', handleSliderMsUp)
    })

    return {
      handleSliderMsDown,
      dom_sliderBar,
      dragging,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.sliderContent {
  flex: none;
  position: relative;
  width: 100px;
  padding: 5px 0;
  // margin-right: 10px;
  display: flex;
  align-items: center;
  opacity: .5;
  transition: opacity @transition-normal;
  &:hover, &.dragging {
    opacity: 1;
    .slider {
      transform: scaleY(1.34);
    }
    .thumb {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
  &.dragging .thumb {
    transform: translate(-50%, -50%) scale(1.15);
    box-shadow: 0 0 0 4px var(--color-primary-alpha-800), 0 4px 10px rgba(70, 88, 106, .18);
  }
  &.disabled {
    opacity: .3;
    .sliderMask {
      cursor: default;
    }
    .thumb {
      display: none;
    }
  }
}

.thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 2px var(--color-primary), 0 4px 10px rgba(70, 88, 106, .16);
  opacity: 0;
  transform: translate(-50%, -50%) scale(.6);
  transition: opacity .18s ease, transform .22s cubic-bezier(.34, 1.56, .64, 1), box-shadow .18s ease, left .2s ease;
  pointer-events: none;
}
.dragging .thumb {
  transition-property: opacity, transform, box-shadow;
}

.slider {
  // cursor: pointer;
  width: 100%;
  height: 6px;
  border-radius: 20px;
  overflow: hidden;
  transition: @transition-normal;
  transition-property: background-color, opacity, transform;
  background-color: rgba(255, 255, 255, .58);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .55);
  // background-color: #f5f5f5;
  position: relative;
  // border-radius: @radius-progress-border;
}

// .muted {
//   opacity: .5;
// }

.sliderBar {
  position: absolute;
  left: 0;
  top: 0;
  transform: scaleX(0);
  transform-origin: 0;
  transition-property: transform;
  transition-timing-function: ease;
  width: 100%;
  height: 100%;
  // border-radius: @radius-progress-border;
  transition-duration: 0.2s;
  background: linear-gradient(90deg, var(--color-primary), #6374ff);
  box-shadow: 0 0 14px var(--color-primary-alpha-800);
}

.sliderMask {
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

</style>
