<template>
  <div :class="$style.content" @click="handleShowPopup" @mouseenter="handlMsEnter" @mouseleave="handlMsLeave">
    <div ref="dom_btn" :class="$style.progressRow">
      <span :class="$style.timeLabel">{{ nowPlayTimeStr }}</span>
      <div :class="$style.progress">
        <div :class="[$style.progressBar, {[$style.barTransition]: isActiveTransition}]" :style="{ transform: `scaleX(${progress || 0})` }" @transitionend="handleTransitionEnd" />
      </div>
      <span :class="$style.timeLabel">{{ maxPlayTimeStr }}</span>
      <base-popup v-model:visible="visible" :btn-el="dom_btn" @mouseenter="handlMsEnter" @mouseleave="handlMsLeave" @transitionend="handleTranEnd">
        <div :class="$style.popupProgress">
          <common-progress-bar v-if="visibleProgress" :progress="progress" :handle-transition-end="handleTransitionEnd" :is-active-transition="isActiveTransition" />
        </div>
      </base-popup>
    </div>
  </div>
</template>

<script>
import { ref } from '@common/utils/vueTools'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import { isShowPlayerDetail } from '@renderer/store/player/state'

export default {
  setup() {
    const visible = ref(false)
    const visibleProgress = ref(false)
    const dom_btn = ref(null)

    const handleShowPopup = (evt) => {
      if (visible.value) {
        evt.stopPropagation()
        handlMsLeave()
      } else handlMsEnter()
    }
    const {
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
      isActiveTransition,
      handleTransitionEnd,
    } = usePlayProgress()

    let timeout = null
    const handlMsEnter = () => {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      if (visible.value) return
      timeout = setTimeout(() => {
        visible.value = true
        visibleProgress.value = true
      }, 100)
    }
    const handlMsLeave = () => {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      if (!visible.value) return
      timeout = setTimeout(() => {
        timeout = null
        visible.value = false
      }, 100)
    }
    const handleTranEnd = () => {
      if (visible.value) return
      visibleProgress.value = false
    }

    // onMounted(() => {
    //   visible.value = true
    //   requestAnimationFrame(() => {
    //     visible.value = false
    //   })
    // })

    return {
      visible,
      visibleProgress,
      dom_btn,
      handleShowPopup,
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
      isActiveTransition,
      handleTransitionEnd,
      handlMsLeave,
      handlMsEnter,
      handleTranEnd,
      isShowPlayerDetail,
    }
  },
}

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
// .content {
//   flex: none;
//   position: relative;
//   // display: inline-block;
//   padding: 5px 0;
//   color: var(--color-300);
//   font-size: 13px;
//   cursor: pointer;
//   transition: opacity @transition-fast;

//   &:hover {
//     opacity: .7;
//   }
// }
.content {
  flex: none;
  position: relative;
  width: 100%;
  padding: 0;
  &:hover {
    .progress {
      opacity: 1;
    }
  }
}
.progressRow {
  position: relative;
  width: 100%;
  height: 22px;
  display: grid;
  grid-template-columns: 48px minmax(120px, 1fr) 48px;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.timeLabel {
  font-size: 12px;
  color: rgba(54, 58, 60, .7);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.progress {
  width: 100%;
  flex: none;
  // width: 160px;
  // position: relative;
  // padding-bottom: 6px;
  // margin: 0 8px;
  height: 4px;
  opacity: .48;
  overflow: hidden;
  transition: @transition-normal;
  transition-property: background-color, opacity;
  background-color: rgba(54, 58, 60, .16);
  border-radius: @radius-progress-border;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .22);

  .progressBar {
    height: 100%;
    width: 100%;
    // position: absolute;
    background-color: var(--color-primary);
    border-radius: @radius-progress-border;
    // left: 0;
    // top: 0;
    transform-origin: 0;
    will-change: transform;
  }

  .barTransition {
    transition-property: transform;
    transition-timing-function: ease-out;
    transition-duration: 0.2s;
  }
}

.popupProgress {
  position: relative;
  width: 300px;
  height: 15px;
  box-sizing: border-box;
  padding: 5px 0;
  margin: 0 5px;
}


</style>
