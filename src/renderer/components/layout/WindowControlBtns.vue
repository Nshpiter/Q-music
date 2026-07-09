<template>
  <div v-show="!hideWhenFullscreen || !isFullscreen" ref="dom_btns" :class="[$style.control, { [$style.fullscreenExitEnabled]: fullscreenExitEnabled }]">
    <button
      v-if="detailAction != 'none'"
      ref="dom_detail_btn"
      type="button"
      :class="$style.hide"
      :aria-label="$t(detailAction == 'hide' ? 'player__hide_detail_tip' : 'player__pic_tip')"
      ignore-tip
      :title="$t(detailAction == 'hide' ? 'player__hide_detail_tip' : 'player__pic_tip')"
      @pointerdown.stop
      @mousedown.stop
      @dblclick.stop
      @click="handleDetail"
    >
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="35%" viewBox="0 0 30.727 30.727" space="preserve">
        <use xlink:href="#icon-window-hide" />
      </svg>
    </button>
    <button
      v-if="fullscreenExitEnabled"
      ref="dom_fullscreen_btn"
      type="button"
      :class="$style.fullscreenExit"
      :aria-label="$t('fullscreen_exit')"
      ignore-tip
      :title="$t('fullscreen_exit')"
      @pointerdown.stop
      @mousedown.stop
      @dblclick.stop
      @click="fullscreenExit"
    >
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="60%">
        <use xlink:href="#icon-fullscreen-exit" />
      </svg>
    </button>
    <button type="button" :class="[$style.btn, $style.min]" :aria-label="$t('min')" ignore-tip :title="$t('min')" @pointerdown.stop @mousedown.stop @dblclick.stop @click="minWindow">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="60%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-window-minimize-2" />
      </svg>
    </button>
    <button type="button" :class="[$style.btn, $style.max]" :aria-label="$t('max')" ignore-tip :title="$t('max')" @pointerdown.stop @mousedown.stop @dblclick.stop @click="maxWindow">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="54%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-window-max" />
      </svg>
    </button>
    <button type="button" :class="[$style.btn, $style.close]" :aria-label="$t('close')" ignore-tip :title="$t('close')" @pointerdown.stop @mousedown.stop @dblclick.stop @click="closeWindow">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="60%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-window-close-2" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, useCssModule } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import { setShowPlayerDetail } from '@renderer/store/player/action'
import { closeWindow, maxWindow, minWindow, setFullScreen } from '@renderer/utils/ipc'

const props = defineProps({
  detailAction: {
    type: String,
    default: 'none',
  },
  fullscreenExitEnabled: {
    type: Boolean,
    default: false,
  },
  hideWhenFullscreen: {
    type: Boolean,
    default: false,
  },
})

const dom_btns = ref()
const dom_detail_btn = ref()
const dom_fullscreen_btn = ref()
const cssModule = useCssModule()

const handle_focus = () => {
  if (!dom_btns.value) return
  for (const node of dom_btns.value.childNodes) {
    if (node.tagName != 'BUTTON') continue
    node.classList.remove(cssModule.hover)
  }
}
const getBtnEl = el => !el || el.tagName == 'BUTTON' ? el : getBtnEl(el.parentNode)
const handle_mouseover = (event) => {
  const btn = getBtnEl(event.target)
  if (!btn) return
  btn.classList.add(cssModule.hover)
}
const handle_mouseout = (event) => {
  const btn = getBtnEl(event.target)
  if (!btn) return
  btn.classList.remove(cssModule.hover)
}

const handleDetail = () => {
  dom_detail_btn.value?.classList.remove(cssModule.hover)
  setShowPlayerDetail(props.detailAction != 'hide')
}
const fullscreenExit = () => {
  dom_fullscreen_btn.value?.classList.remove(cssModule.hover)
  void setFullScreen(false).then((fullscreen) => {
    isFullscreen.value = fullscreen
  })
}

onMounted(() => {
  window.app_event.on('focus', handle_focus)
  dom_btns.value?.addEventListener('mouseover', handle_mouseover)
  dom_btns.value?.addEventListener('mouseout', handle_mouseout)
})
onBeforeUnmount(() => {
  window.app_event.off('focus', handle_focus)
  dom_btns.value?.removeEventListener('mouseover', handle_mouseover)
  dom_btns.value?.removeEventListener('mouseout', handle_mouseout)
})

</script>

<style lang="less" module>
.control {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  height: 34px;
  pointer-events: auto;
  -webkit-app-region: no-drag !important;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 46px;
    height: 34px;
    padding: 1px;
    color: var(--color-font-label);
    background: none;
    border: none;
    outline: none;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;
    pointer-events: auto;
    -webkit-app-region: no-drag !important;

    &.hover {
      background-color: var(--color-button-background-hover);

      &.close {
        background-color: var(--color-btn-close);
      }
    }
  }

  .fullscreenExit {
    display: none;
  }
}

:global(.fullscreen) {
  .fullscreenExitEnabled {
    .close,
    .min,
    .max {
      display: none;
    }

    .fullscreenExit {
      display: flex;
    }
  }
}
</style>
