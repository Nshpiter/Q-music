<template lang="pug">
transition(enter-active-class="q-detail-enter-active" leave-active-class="q-detail-leave-active" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave")
  div(v-if="isShowPlayerDetail" :class="[$style.container, appSetting['playDetail.style.layout'] == 'immersive' ? $style.immersive : $style.classic, { fullscreen: isFullscreen }]" @contextmenu="handleContextMenu")
    div(:class="$style.bg" :style="detailBgStyle")
    //- div(:class="$style.bg" :style="bgStyle")
    //- div(:class="$style.bg2")
    ControlBtnsLeftHeader(v-if="appSetting['common.controlBtnPosition'] == 'left'" :detail-action-enabled="appSetting['playDetail.style.layout'] != 'immersive'")
    ControlBtnsRightHeader(v-else)
    button(type="button" :class="$style.detailBackBtn" :aria-label="$t('player__hide_detail_tip')" :title="$t('player__hide_detail_tip')" @click="hide")
      svg(viewBox="0 0 24 24" aria-hidden="true")
        path(d="M6.5 9.5 12 15l5.5-5.5")
    div(ref="dom_main" :class="[$style.main, {[$style.showComment]: isCommentLayoutVisible, [$style.commentOpening]: isCommentLayoutOpening, [$style.commentGliding]: isCommentLayoutGliding, [$style.commentClosing]: isCommentLayoutClosing, [$style.commentSettling]: isCommentLayoutSettling}]" :style="mainStyle")
      div.left(:class="$style.left")
        div(ref="dom_record" :class="['q-album-stage', $style.albumStage]")
          div(:class="$style.record")
            img(v-if="musicInfo.pic" :class="$style.img" :src="musicInfo.pic")
            div(v-else :class="$style.emptyCover")
              EmptyCoverMark(:class="$style.emptyCoverMark")
          div(v-if="appSetting['playDetail.style.layout'] == 'classic'" :class="$style.toneArm" aria-hidden="true")
            span(:class="$style.toneArmBase")
            span(:class="$style.toneArmRod")
            span(:class="$style.toneArmHead")
        div.description(:class="['scroll', $style.description]")
          p {{ musicInfo.name }}
          p {{ musicInfo.singer }}
          p(v-if="musicInfo.album") {{ musicInfo.album }}

      LyricPlayer(:comment-layout-visible="isCommentLayoutVisible" :comment-layout-settling="isCommentLayoutSettling")
      button(
        v-show="isCommentLayoutVisible"
        type="button"
        :class="[$style.commentResizeHandle, { [$style.commentResizeHandleActive]: isCommentResizing }]"
        aria-label="Resize lyric and comment panels"
        @pointerdown.stop.prevent="handleCommentResizeStart"
        @mousedown.stop.prevent="handleCommentResizeStart"
        @touchstart.stop.prevent="handleCommentResizeStart"
      )
      //- gliding 期间不置 show，推迟评论拉取与列表渲染到滑动结束后，
      //- 避免大量评论节点的创建/布局阻塞封面歌词的滑动动画
      music-comment(:class="$style.comment" :show="isShowPlayComment && !isCommentLayoutGliding" :music-info="playMusicInfo.musicInfo" @close="hideComment")
    transition(enter-active-class="animated-slow fadeIn" leave-active-class="animated-slow fadeOut")
      common-audio-visualizer(v-if="appSetting['player.audioVisualization'] && visibled")
</template>


<script>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import {
  isShowPlayerDetail,
  isShowPlayComment,
  musicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setShowPlayerDetail,
  setShowPlayComment,
  setShowPlayLrcSelectContentLrc,
} from '@renderer/store/player/action'
import LyricPlayer from './LyricPlayer.vue'
import MusicComment from './components/MusicComment/index.vue'
import ControlBtnsLeftHeader from './ControlBtnsLeftHeader.vue'
import ControlBtnsRightHeader from './ControlBtnsRightHeader.vue'
import EmptyCoverMark from '@renderer/components/common/EmptyCoverMark.vue'
import { registerAutoHideMounse, unregisterAutoHideMounse } from './autoHideMounse'
import { appSetting } from '@renderer/store/setting'
import { closeWindow, maxWindow, minWindow, setFullScreen } from '@renderer/utils/ipc'

const COMMENT_WIDTH_KEY = 'q-music.play-detail.comment-width'
const COMMENT_MIN_WIDTH = 320
const COMMENT_MAX_WIDTH = 720
const COVER_MIN_WIDTH = 240
const COVER_MAX_WIDTH = 330
const LYRIC_MIN_WIDTH = 300
const RESIZE_HANDLE_WIDTH = 24
const COMMENT_LAYOUT_GAP = 18
const COMMENT_LAYOUT_CLOSE_MS = 500
const FLIP_DURATION_MS = 560
const FLIP_EASING = 'cubic-bezier(.22, 1, .36, 1)'
// 封面/歌词滑动接近结束时再淡入评论面板，略短于 FLIP 时长让两段衔接自然
const COMMENT_LAYOUT_GLIDE_MS = 470
// 一帧耗时超过该值判定为「繁重帧」（新布局首次重排/绘制），需等它过去再开始滑动
const FLIP_HEAVY_FRAME_MS = 40
// 连续若干正常帧即认为主线程已空闲，可直接开始滑动
const FLIP_CLEAR_FRAME_STREAK = 3
// 最长等待，兜底防止始终等不到判定条件
const FLIP_RELEASE_MAX_WAIT_MS = 320
const IMMERSIVE_CONTROLS_IDLE_MS = 2200

const getInitialCommentWidth = () => {
  try {
    const savedWidth = Number(window.localStorage.getItem(COMMENT_WIDTH_KEY))
    if (Number.isFinite(savedWidth)) {
      return Math.min(Math.max(savedWidth, COMMENT_MIN_WIDTH), COMMENT_MAX_WIDTH)
    }
  } catch (_) {}
  return 520
}

export default {
  name: 'CorePlayDetail',
  components: {
    ControlBtnsLeftHeader,
    ControlBtnsRightHeader,
    EmptyCoverMark,
    LyricPlayer,
    MusicComment,
  },
  setup() {
    const visibled = ref(false)
    const dom_main = ref(null)
    const dom_record = ref(null)
    const commentWidth = ref(getInitialCommentWidth())
    const isCommentResizing = ref(false)
    const isCommentLayoutVisible = ref(isShowPlayComment.value)
    const isCommentLayoutOpening = ref(false)
    const isCommentLayoutGliding = ref(false)
    const isCommentLayoutClosing = ref(false)
    const isCommentLayoutSettling = ref(false)
    const lastMainWidth = ref(0)
    let activePointerId = null
    let activeResizeType = null
    let resizeHandleElement = null
    let resizeStartX = 0
    let resizeStartWidth = 0
    let commentLayoutCloseTimer = null
    let commentLayoutGlideTimer = null
    let immersiveControlsTimer = null
    let immersiveActivityRoot = null
    let isInteractingWithPlayerControls = false

    const clearImmersiveControlsTimer = () => {
      if (immersiveControlsTimer == null) return
      window.clearTimeout(immersiveControlsTimer)
      immersiveControlsTimer = null
    }
    const showImmersiveControls = () => {
      document.body.classList.remove('immersive-controls-hidden')
    }
    const scheduleImmersiveControlsHide = () => {
      clearImmersiveControlsTimer()
      if (!isShowPlayerDetail.value || appSetting['playDetail.style.layout'] != 'immersive') {
        showImmersiveControls()
        return
      }
      immersiveControlsTimer = window.setTimeout(() => {
        immersiveControlsTimer = null
        if (isInteractingWithPlayerControls || isShowPlayComment.value || isCommentResizing.value) {
          scheduleImmersiveControlsHide()
          return
        }
        document.body.classList.add('immersive-controls-hidden')
      }, IMMERSIVE_CONTROLS_IDLE_MS)
    }
    const handleImmersiveActivity = () => {
      showImmersiveControls()
      scheduleImmersiveControlsHide()
    }
    const handleImmersivePointerDown = event => {
      const target = event.target instanceof Element ? event.target : null
      isInteractingWithPlayerControls = Boolean(target?.closest('.q-player-footer'))
      handleImmersiveActivity()
    }
    const handleImmersivePointerUp = () => {
      isInteractingWithPlayerControls = false
      handleImmersiveActivity()
    }
    const handleImmersivePointerLeave = () => {
      isInteractingWithPlayerControls = false
      scheduleImmersiveControlsHide()
    }
    const detailBgStyle = computed(() => {
      if (!musicInfo.pic) return {}
      return {
        '--play-detail-cover': `url("${String(musicInfo.pic).replace(/"/g, '\\"')}")`,
      }
    })
    const mainStyle = computed(() => {
      return isCommentLayoutVisible.value
        ? {
            '--comment-width': `${commentWidth.value}px`,
            '--cover-width': `${getCoverWidth(lastMainWidth.value)}px`,
          }
        : {}
    })

    const clearCommentLayoutCloseTimer = () => {
      if (!commentLayoutCloseTimer) return
      window.clearTimeout(commentLayoutCloseTimer)
      commentLayoutCloseTimer = null
    }
    const clearCommentLayoutGlideTimer = () => {
      if (!commentLayoutGlideTimer) return
      window.clearTimeout(commentLayoutGlideTimer)
      commentLayoutGlideTimer = null
    }
    const settleCommentLayout = () => {
      isCommentLayoutSettling.value = true
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          isCommentLayoutSettling.value = false
        })
      })
    }

    let flipCleanups = []
    const clearFlipAnimations = () => {
      while (flipCleanups.length) flipCleanups.pop()()
    }
    // FLIP：布局瞬间切换后，用 transform 把元素拉回旧位置（First 步，无过渡），
    // 返回一个「释放」函数；在下一帧调用它才开始过渡，确保旧位置已作为过渡起点提交，
    // 否则同一 tick 内设置起止值时浏览器可能不识别过渡起点，导致元素卡住后突然跳变。
    const pinFlipToFirst = (el, firstRect, allowScale = true) => {
      const lastRect = el.getBoundingClientRect()
      if (!firstRect.width || !lastRect.width || !lastRect.height) return null
      const dx = (firstRect.left + firstRect.width / 2) - (lastRect.left + lastRect.width / 2)
      const dy = (firstRect.top + firstRect.height / 2) - (lastRect.top + lastRect.height / 2)
      // 文本类元素（歌词/说明）不缩放：内容已按新宽度重排，缩放大段文字会逐帧
      // 重新栅格化造成卡顿，只做位移即可获得廉价且顺滑的滑动
      const scale = allowScale ? firstRect.width / lastRect.width : 1
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(scale - 1) < 0.01) return null
      const computed = window.getComputedStyle(el).transform
      const baseTransform = computed && computed != 'none' ? computed : ''
      el.style.transition = 'none'
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale}) ${baseTransform}`.trim()
      el.style.willChange = 'transform'
      let timer = null
      const cleanup = () => {
        if (timer) window.clearTimeout(timer)
        timer = null
        el.style.transition = ''
        el.style.transform = ''
        el.style.willChange = ''
      }
      flipCleanups.push(cleanup)
      // 释放：Last 步，平滑过渡回元素在新布局中的自然位置
      return () => {
        el.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`
        el.style.transform = baseTransform
        timer = window.setTimeout(cleanup, FLIP_DURATION_MS + 60)
      }
    }
    const getCommentMaxWidth = width => {
      if (!width) return COMMENT_MAX_WIDTH
      const layoutReserve = getCoverWidth(width) + LYRIC_MIN_WIDTH + RESIZE_HANDLE_WIDTH + COMMENT_LAYOUT_GAP * 3
      return Math.min(COMMENT_MAX_WIDTH, Math.max(COMMENT_MIN_WIDTH, width - layoutReserve))
    }

    function getCoverWidth(width) {
      if (!width) return 340
      return Math.round(Math.min(Math.max(width * 0.23, COVER_MIN_WIDTH), COVER_MAX_WIDTH))
    }

    let clickTime = 0

    const hide = () => {
      setShowPlayerDetail(false)
    }
    const handleContextMenu = () => {
      if (window.performance.now() - clickTime > 400) {
        clickTime = window.performance.now()
        return
      }
      clickTime = 0
      hide()
    }

    const hideComment = () => {
      setShowPlayComment(false)
    }

    const updateMainWidth = () => {
      const rect = dom_main.value?.getBoundingClientRect()
      if (!rect) return
      lastMainWidth.value = rect.width
      commentWidth.value = Math.min(Math.max(commentWidth.value, COMMENT_MIN_WIDTH), getCommentMaxWidth(rect.width))
    }

    const getClientX = event => {
      return event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? event.clientX
    }

    const updateCommentWidth = event => {
      if (!isCommentResizing.value) return
      if (activeResizeType === 'pointer' && activePointerId != null && event.pointerId !== activePointerId) return
      if (event.cancelable) event.preventDefault()
      const rect = dom_main.value?.getBoundingClientRect()
      const clientX = getClientX(event)
      if (!rect || clientX == null) return
      lastMainWidth.value = rect.width
      const maxWidth = getCommentMaxWidth(rect.width)
      const nextWidth = resizeStartWidth + resizeStartX - clientX
      commentWidth.value = Math.round(Math.min(Math.max(nextWidth, COMMENT_MIN_WIDTH), maxWidth))
    }

    const stopCommentResize = event => {
      if (activeResizeType === 'pointer' && event?.pointerId != null && activePointerId != null && event.pointerId !== activePointerId) return
      if (!isCommentResizing.value) return
      isCommentResizing.value = false
      document.body.classList.remove('q-comment-resizing')
      if (activeResizeType === 'pointer' && resizeHandleElement && activePointerId != null) {
        try {
          resizeHandleElement.releasePointerCapture?.(activePointerId)
        } catch (_) {}
      }
      document.removeEventListener('pointermove', updateCommentWidth)
      document.removeEventListener('pointerup', stopCommentResize)
      document.removeEventListener('pointercancel', stopCommentResize)
      document.removeEventListener('mousemove', updateCommentWidth)
      document.removeEventListener('mouseup', stopCommentResize)
      document.removeEventListener('touchmove', updateCommentWidth)
      document.removeEventListener('touchend', stopCommentResize)
      document.removeEventListener('touchcancel', stopCommentResize)
      activePointerId = null
      activeResizeType = null
      resizeHandleElement = null

      try {
        window.localStorage.setItem(COMMENT_WIDTH_KEY, String(commentWidth.value))
      } catch (_) {}
    }

    const handleCommentResizeStart = event => {
      if (!isShowPlayComment.value) return
      if (isCommentResizing.value) return
      if (event.isPrimary === false) return
      updateMainWidth()
      const clientX = getClientX(event)
      if (clientX == null) return
      activeResizeType = event.pointerId == null ? (event.type === 'touchstart' ? 'touch' : 'mouse') : 'pointer'
      activePointerId = event.pointerId ?? null
      resizeHandleElement = event.currentTarget
      resizeStartX = clientX
      resizeStartWidth = commentWidth.value
      if (activeResizeType === 'pointer') resizeHandleElement?.setPointerCapture?.(activePointerId)
      isCommentResizing.value = true
      document.body.classList.add('q-comment-resizing')
      if (activeResizeType === 'pointer') {
        document.addEventListener('pointermove', updateCommentWidth, { passive: false })
        document.addEventListener('pointerup', stopCommentResize)
        document.addEventListener('pointercancel', stopCommentResize)
      } else if (activeResizeType === 'touch') {
        document.addEventListener('touchmove', updateCommentWidth, { passive: false })
        document.addEventListener('touchend', stopCommentResize)
        document.addEventListener('touchcancel', stopCommentResize)
      } else {
        document.addEventListener('mousemove', updateCommentWidth)
        document.addEventListener('mouseup', stopCommentResize)
      }
    }

    const handleAfterEnter = () => {
      if (isFullscreen.value) registerAutoHideMounse()

      visibled.value = true
    }

    const handleAfterLeave = () => {
      setShowPlayLrcSelectContentLrc(false)
      hideComment(false)
      visibled.value = false

      unregisterAutoHideMounse()
    }

    watch(isFullscreen, isFullscreen => {
      (isFullscreen ? registerAutoHideMounse : unregisterAutoHideMounse)()
    })

    watch([isShowPlayerDetail, () => appSetting['playDetail.style.layout']], ([visible, layout]) => {
      showImmersiveControls()
      if (visible && layout == 'immersive') scheduleImmersiveControlsHide()
      else clearImmersiveControlsTimer()
    })

    watch(isShowPlayComment, visible => {
      clearCommentLayoutCloseTimer()
      clearCommentLayoutGlideTimer()
      if (!visible) {
        stopCommentResize()
        clearFlipAnimations()
        isCommentLayoutOpening.value = false
        isCommentLayoutGliding.value = false
        if (isCommentLayoutVisible.value) {
          isCommentLayoutClosing.value = true
          commentLayoutCloseTimer = window.setTimeout(() => {
            commentLayoutCloseTimer = null
            settleCommentLayout()
            isCommentLayoutVisible.value = false
            isCommentLayoutClosing.value = false
          }, COMMENT_LAYOUT_CLOSE_MS)
        }
        return
      }
      if (isCommentLayoutVisible.value) return
      clearFlipAnimations()
      // 布局切换前记录各元素的旧位置，切换后用 FLIP 平滑移动过去。
      // 封面是小图层，可缩放；歌词/说明是文本，仅位移不缩放。
      const coverEl = dom_record.value
      const descriptionEl = dom_main.value?.querySelector('.left .description')
      const lyricEl = dom_main.value?.querySelector('.right')
      const firstRects = [
        { el: coverEl, scale: true },
        { el: descriptionEl, scale: false },
        { el: lyricEl, scale: false },
      ].map(item => item.el ? { el: item.el, scale: item.scale, rect: item.el.getBoundingClientRect() } : null)
      isCommentLayoutVisible.value = true
      isCommentLayoutOpening.value = true
      // gliding 期间评论面板保持隐藏（其 backdrop-filter 首次绘制很重），
      // 等封面/歌词滑动结束后再淡入，避免重绘卡在动画中途
      isCommentLayoutGliding.value = true
      isCommentLayoutClosing.value = false
      isCommentLayoutSettling.value = false
      setTimeout(updateMainWidth)
      void nextTick(() => {
        const releases = firstRects.map(item => item ? pinFlipToFirst(item.el, item.rect, item.scale) : null)
        // 释放过渡：撤下开场类，封面/歌词从旧位置平滑滑向新位置；
        // 并让评论面板在滑动尾声淡入
        const startGlide = () => {
          isCommentLayoutOpening.value = false
          for (const release of releases) release && release()
          clearCommentLayoutGlideTimer()
          commentLayoutGlideTimer = window.setTimeout(() => {
            commentLayoutGlideTimer = null
            isCommentLayoutGliding.value = false
          }, COMMENT_LAYOUT_GLIDE_MS)
        }
        // 切到 grid 后的第一帧要做整套新布局的重排/绘制，很繁重；先让封面/歌词
        // 钉在旧位置静止不动，等这一帧过去、主线程空闲后再开始滑动，
        // 把卡顿吸收在静止阶段，保证滑动本身丝滑
        let prevTs = 0
        let deadline = 0
        let sawHeavyFrame = false
        let normalStreak = 0
        const waitClearFrame = ts => {
          if (!deadline) deadline = ts + FLIP_RELEASE_MAX_WAIT_MS
          if (prevTs) {
            const dt = ts - prevTs
            if (dt > FLIP_HEAVY_FRAME_MS) {
              sawHeavyFrame = true
              normalStreak = 0
            } else {
              normalStreak++
              if (sawHeavyFrame || normalStreak >= FLIP_CLEAR_FRAME_STREAK) {
                startGlide()
                return
              }
            }
          }
          prevTs = ts
          if (ts >= deadline) {
            startGlide()
            return
          }
          window.requestAnimationFrame(waitClearFrame)
        }
        window.requestAnimationFrame(waitClearFrame)
      })
    })

    onMounted(() => {
      window.addEventListener('resize', updateMainWidth)
      immersiveActivityRoot = document.getElementById('container')
      immersiveActivityRoot?.addEventListener('pointermove', handleImmersiveActivity, { passive: true })
      immersiveActivityRoot?.addEventListener('pointerdown', handleImmersivePointerDown, { passive: true })
      immersiveActivityRoot?.addEventListener('pointerup', handleImmersivePointerUp, { passive: true })
      immersiveActivityRoot?.addEventListener('pointercancel', handleImmersivePointerUp, { passive: true })
      immersiveActivityRoot?.addEventListener('pointerleave', handleImmersivePointerLeave, { passive: true })
      immersiveActivityRoot?.addEventListener('wheel', handleImmersiveActivity, { passive: true })
      immersiveActivityRoot?.addEventListener('keydown', handleImmersiveActivity)
      scheduleImmersiveControlsHide()
    })

    onBeforeUnmount(() => {
      clearCommentLayoutCloseTimer()
      clearCommentLayoutGlideTimer()
      clearFlipAnimations()
      stopCommentResize()
      clearImmersiveControlsTimer()
      showImmersiveControls()
      window.removeEventListener('resize', updateMainWidth)
      immersiveActivityRoot?.removeEventListener('pointermove', handleImmersiveActivity)
      immersiveActivityRoot?.removeEventListener('pointerdown', handleImmersivePointerDown)
      immersiveActivityRoot?.removeEventListener('pointerup', handleImmersivePointerUp)
      immersiveActivityRoot?.removeEventListener('pointercancel', handleImmersivePointerUp)
      immersiveActivityRoot?.removeEventListener('pointerleave', handleImmersivePointerLeave)
      immersiveActivityRoot?.removeEventListener('wheel', handleImmersiveActivity)
      immersiveActivityRoot?.removeEventListener('keydown', handleImmersiveActivity)
      immersiveActivityRoot = null
    })


    return {
      appSetting,
      playMusicInfo,
      isShowPlayerDetail,
      isShowPlayComment,
      isCommentLayoutVisible,
      isCommentLayoutOpening,
      isCommentLayoutGliding,
      isCommentLayoutClosing,
      isCommentLayoutSettling,
      musicInfo,
      dom_main,
      dom_record,
      detailBgStyle,
      mainStyle,
      isCommentResizing,
      hide,
      handleContextMenu,
      hideComment,
      handleCommentResizeStart,
      handleAfterEnter,
      handleAfterLeave,
      visibled,
      isFullscreen,
      fullscreenExit() {
        void setFullScreen(false).then((fullscreen) => {
          isFullscreen.value = fullscreen
        })
      },
      min() {
        minWindow()
      },
      max() {
        maxWindow()
      },
      close() {
        closeWindow()
      },
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@control-btn-width: @height-toolbar * .26;
@comment-resize-handle-width: 28px;
@comment-layout-duration: .5s;
@comment-layout-easing: cubic-bezier(.22, 1, .36, 1);
@comment-layout-easing-soft: cubic-bezier(.2, .8, .2, 1);
@play-detail-main-padding-top: 8px;
@play-detail-main-padding-bottom: @height-player * 1.16;
@play-detail-main-center-offset: (@play-detail-main-padding-bottom - @play-detail-main-padding-top) / 2;

.container {
  position: absolute;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background-color: #161a1d;
  z-index: 10;
  // -webkit-app-region: drag;
  overflow: hidden;
  border-radius: @radius-border;
  color: rgba(255, 255, 255, .94);
  // border-left: 12px solid var(--color-primary-alpha-900);
  -webkit-app-region: no-drag;
  contain: strict;
  padding-bottom: 0;

  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
}

.detailBackBtn {
  position: absolute;
  top: 17px;
  left: clamp(58px, 4.8vw, 82px);
  z-index: 20;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 50%;
  color: rgba(255, 255, 255, .78);
  background: rgba(18, 23, 27, .28);
  box-shadow: 0 10px 28px rgba(0, 0, 0, .12);
  backdrop-filter: blur(14px);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: color .2s ease, background .2s ease, transform .2s ease;

  svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, .14);
    transform: translateY(2px);
  }
}

:global(.q-detail-enter-active) {
  animation: qDetailEnter .42s cubic-bezier(.16, 1, .3, 1);
}

:global(.q-detail-leave-active) {
  animation: qDetailLeave .28s ease forwards;
}

@keyframes qDetailEnter {
  from {
    opacity: 0;
    transform: translateY(28px) scale(.97);
    filter: saturate(.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: saturate(1);
  }
}

@keyframes qDetailLeave {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(34px) scale(.98);
  }
}

.bg {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  --play-detail-cover: var(--background-image);
  background:
    var(--play-detail-cover) center / cover no-repeat,
    var(--background-image) var(--background-image-position) / var(--background-image-size) no-repeat;
  filter: blur(76px) saturate(1.42) brightness(.76);
  transform: scale(1.2);
  opacity: .88;
  z-index: -1;
  &:before {
    position: absolute;
    left: 0;
    top: 0;
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background:
      radial-gradient(circle at 24% 48%, rgba(255, 255, 255, .12), transparent 34%),
      radial-gradient(circle at 72% 38%, rgba(255, 255, 255, .08), transparent 38%),
      linear-gradient(120deg, rgba(8, 12, 16, .2), rgba(15, 20, 24, .48));
  }
  &:after {
    position: absolute;
    left: 0;
    top: 0;
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background:
      linear-gradient(90deg, rgba(10, 14, 17, .18), rgba(10, 14, 17, .04) 46%, rgba(10, 14, 17, .28)),
      linear-gradient(180deg, rgba(11, 14, 17, .16), rgba(11, 15, 18, .34) 58%, rgba(11, 15, 18, .66));
  }
}
// .bg2 {
//   position: absolute;
//   width: 100%;
//   height: 100%;
//   top: 0;
//   left: 0;
//   z-index: -1;
//   background-color: rgba(255, 255, 255, .8);
// }

.main {
  --comment-width: clamp(420px, 36vw, 560px);
  --cover-width: 360px;
  --normal-gap: clamp(52px, 7vw, 112px);
  --normal-left-width: min(42%, 520px);
  --normal-right-width: min(690px, calc(100% - var(--normal-left-width) - var(--normal-gap)));
  --normal-content-left: max(0px, calc((100% - var(--normal-left-width) - var(--normal-right-width) - var(--normal-gap)) / 2));
  --normal-lyric-left: calc(var(--normal-content-left) + var(--normal-left-width) + var(--normal-gap));
  --closing-lyric-width: clamp(520px, 42vw, 690px);
  flex: auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--normal-gap);
  margin: 0 clamp(56px, 7vw, 96px);
  padding: @play-detail-main-padding-top 0 @play-detail-main-padding-bottom;
  position: relative;
  z-index: 2;
  transition:
    grid-template-columns @comment-layout-duration @comment-layout-easing,
    margin @comment-layout-duration @comment-layout-easing,
    padding @comment-layout-duration @comment-layout-easing,
    gap @comment-layout-duration @comment-layout-easing;

  &.showComment {
    --cover-space: var(--cover-width, clamp(250px, 23vw, 350px));
    display: grid;
    grid-template-columns: minmax(300px, 1fr) @comment-resize-handle-width minmax(320px, var(--comment-width));
    gap: clamp(12px, 1.4vw, 18px);
    margin: 0 clamp(24px, 3.5vw, 52px);
    padding-left: var(--cover-space);
    padding-bottom: calc(@height-player * .7);
    align-items: center;

    .left {
      position: absolute;
      left: 0;
      top: 50%;
      z-index: 3;
      display: flex;
      width: calc(var(--cover-space) - 20px);
      height: calc(100% - 36px);
      min-width: 0;
      flex-basis: auto;
      opacity: 1;
      visibility: visible;
      transform: translate3d(0, -50%, 0) scale(.985);
      will-change: transform, width, height;
      backface-visibility: hidden;
    }

    .albumStage {
      width: min(100%, calc(var(--cover-space) - 42px));
      transform: translate3d(0, -2px, 0) scale(.97);
      will-change: transform, width;
      backface-visibility: hidden;
    }

    .description {
      width: min(100%, calc(var(--cover-space) - 42px));
      margin-top: 16px;
      opacity: .86;
      transform: translate3d(0, -2px, 0);
    }

    .comment {
      width: 100%;
      min-width: 0;
      flex-basis: auto;
      opacity: 1;
      transform: translate3d(0, 0, 0);
      pointer-events: auto;
      // 面板在封面/歌词滑动结束后（撤下 gliding 时）淡入滑落，避免重绘卡住动画
      transition:
        opacity .46s @comment-layout-easing-soft,
        transform .5s @comment-layout-easing;
    }

    .commentResizeHandle {
      width: @comment-resize-handle-width;
      flex-basis: auto;
      opacity: .74;
      pointer-events: auto;
    }

    :global {
      .right {
        width: 100%;
        height: 100%;
        flex: none;
        max-width: none;
        min-width: 0;
        .lyricSelectContent {
          font-size: 14px;
        }
      }
      .left {
        .description p {
          font-size: 12px;
        }
      }
    }
  }

  &.showComment.commentClosing {
    grid-template-columns: var(--closing-lyric-width) 0 minmax(0, 0);
    justify-content: start;
    gap: 0;
    margin: 0 clamp(56px, 7vw, 96px);
    padding-left: calc(clamp(280px, 31vw, 430px) + var(--normal-gap));
    padding-bottom: @play-detail-main-padding-bottom;

    .left {
      pointer-events: none;
      left: var(--normal-content-left);
      top: calc(50% - @play-detail-main-center-offset);
      width: var(--normal-left-width);
      height: 100%;
      transform: translate3d(0, -50%, 0) scale(1);
      animation: none;
    }

    .albumStage {
      width: clamp(280px, 31vw, 430px);
      transform: translate3d(0, 0, 0) scale(1);
    }

    .description {
      width: min(100%, 430px);
      margin-top: 22px;
      opacity: .9;
      transform: translate3d(0, 0, 0);
    }

    .comment {
      width: 0;
      pointer-events: none;
      animation: qCommentPanelLeave .28s ease both;
    }

    .commentResizeHandle {
      width: 0;
      flex-basis: 0;
      opacity: 0;
      pointer-events: none;
    }

    :global {
      .left {
        .description p {
          font-size: 14px;

          &:first-child {
            font-size: 17px;
          }
        }
      }

      .right {
        width: var(--closing-lyric-width);
        max-width: var(--closing-lyric-width);
        animation: none;
      }
    }
  }

  &.commentSettling {
    transition: none !important;

    .left,
    .albumStage,
    .description,
    .comment,
    .commentResizeHandle {
      transition: none !important;
      animation: none !important;
    }

    :global {
      .right {
        transition: none !important;
        animation: none !important;
      }
    }
  }

  // FLIP 开场帧：布局刚从 flex 切到 grid，让 .main 的栅格/间距瞬间落到终态，
  // 各元素也不走类过渡（改由 JS 设置的 inline transform 过渡驱动）。
  // 注意这里不能用 !important —— 否则会盖掉 FLIP 写在 style 上的 transition，
  // 导致封面/歌词直接跳到终点而非平滑滑入（class !important 优先级高于 inline）。
  &.commentOpening {
    transition: none;

    .left,
    .albumStage,
    .description,
    .comment,
    .commentResizeHandle {
      transition: none;
      animation: none;
    }

    :global {
      .right {
        transition: none;
        animation: none;
      }
    }
  }

  // gliding 阶段：封面/歌词正在滑动，评论面板保持隐藏（visibility 跳过其
  // backdrop-filter 的昂贵首绘），撤下该类时面板才淡入滑落，衔接下一段。
  &.commentGliding {
    .comment {
      visibility: hidden;
      opacity: 0;
      transform: translate3d(30px, 0, 0);
      transition: none;
    }
  }
}
.left {
  flex: 0 0 min(42%, 520px);
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: visible;
  transition:
    flex-basis @comment-layout-duration @comment-layout-easing,
    width @comment-layout-duration @comment-layout-easing,
    height @comment-layout-duration @comment-layout-easing,
    opacity @transition-fast,
    transform @comment-layout-duration @comment-layout-easing;
}

.albumStage {
  position: relative;
  width: clamp(280px, 31vw, 430px);
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    width @comment-layout-duration @comment-layout-easing,
    transform @comment-layout-duration @comment-layout-easing,
    filter .32s ease;

  &:before {
    content: '';
    position: absolute;
    left: 7%;
    right: 7%;
    bottom: -2%;
    z-index: 0;
    height: 20%;
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(ellipse at center, rgba(0, 0, 0, .56), rgba(0, 0, 0, .2) 48%, transparent 74%);
    filter: blur(28px);
    opacity: .78;
    transform: translateY(20px);
    transition: opacity .32s ease, transform @comment-layout-duration @comment-layout-easing;
  }

  &:hover {
    filter: saturate(1.06) brightness(1.03);
    transform: translate3d(0, -5px, 0) scale(1.012);

    &:before {
      opacity: .9;
      transform: translateY(23px) scale(1.04);
    }
  }
}
.record {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: clamp(22px, 2.2vw, 32px);
  background: rgba(255, 255, 255, .12);
  border: 1px solid rgba(255, 255, 255, .2);
  box-shadow:
    0 30px 70px rgba(0, 0, 0, .34),
    0 8px 24px rgba(0, 0, 0, .22),
    inset 0 1px 0 rgba(255, 255, 255, .24);

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    border-radius: inherit;
    background: linear-gradient(145deg, rgba(255, 255, 255, .16), transparent 32%, transparent 68%, rgba(255, 255, 255, .05));
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08);
  }

}
.img {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}
.emptyCover {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  color: rgba(255, 255, 255, .74);
  background:
    radial-gradient(circle at 32% 28%, rgba(255, 255, 255, .16), transparent 36%),
    linear-gradient(145deg, rgba(75, 87, 94, .9), rgba(28, 34, 39, .96));
}
.emptyCoverMark {
  width: 16%;
  height: 16%;
}

.toneArm {
  position: absolute;
  z-index: 4;
  right: 10%;
  top: -3%;
  width: 30%;
  height: 60%;
  transform: rotate(-10deg);
  transform-origin: 80% 12%;
  pointer-events: none;
  filter: drop-shadow(8px 12px 16px rgba(42, 50, 56, .2));
}

.toneArmBase {
  position: absolute;
  right: 10%;
  top: 2%;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 36%, #fff, #d8e0dc 56%, #aebbb6);
  box-shadow: inset 0 0 0 8px rgba(230, 236, 233, .72), 0 10px 24px rgba(48, 58, 66, .18);
}

.toneArmRod {
  position: absolute;
  right: 29%;
  top: 15%;
  width: 9px;
  height: 77%;
  border-radius: 999px;
  transform: rotate(13deg);
  transform-origin: 50% 8%;
  background: linear-gradient(90deg, #84918e, #f3f7f5 32%, #9eaaa7 64%, #e9efec);
}

.toneArmHead {
  position: absolute;
  right: 43%;
  bottom: 5%;
  width: 32px;
  height: 23px;
  border-radius: 9px;
  transform: rotate(25deg);
  background: linear-gradient(160deg, #f4f8f6, #aebbb8);
  box-shadow: 4px 7px 14px rgba(38, 48, 56, .2);
}

.description {
  width: min(100%, 430px);
  max-height: 92px;
  margin-top: 22px;
  padding: 0 8px;
  text-align: left;
  color: rgba(255, 255, 255, .58);
  transition:
    width @comment-layout-duration @comment-layout-easing,
    margin-top @comment-layout-duration @comment-layout-easing,
    opacity @transition-fast,
    transform @comment-layout-duration @comment-layout-easing;
  p {
    line-height: 1.55;
    font-size: 14px;
    overflow-wrap: break-word;
    color: rgba(255, 255, 255, .58);
    .mixin-ellipsis-1();

    &:first-child {
      color: rgba(255, 255, 255, .94);
      font-size: 20px;
      font-weight: 700;
    }
  }
}


.comment {
  flex: 0 0 0;
  min-width: 0;
  height: 100%;
  opacity: 0;
  transform: translate3d(18px, 0, 0);
  transform-origin: right center;
  pointer-events: none;
  will-change: opacity, transform;
  backface-visibility: hidden;
  transition:
    flex-basis .42s @comment-layout-easing,
    opacity .28s ease,
    transform .42s @comment-layout-easing;
}

// 打开评论时布局是 flex→grid 的瞬时切换，入场动画需要足够的幅度
// 来重建元素的运动逻辑：封面从中央大图缩小落到左侧、歌词从右半区滑到中列、评论从右缘滑入
@keyframes qCommentPanelLeave {
  from {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    opacity: 0;
    transform: translate3d(56px, 0, 0) scale(.99);
  }
}

.commentResizeHandle {
  position: relative;
  z-index: 5;
  flex: 0 0 0;
  display: block;
  align-self: stretch;
  width: 0;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: col-resize;
  opacity: 0;
  pointer-events: none;
  touch-action: none;
  -webkit-app-region: no-drag;
  transition:
    flex-basis .42s @comment-layout-easing,
    opacity @transition-fast;

  &:before {
    content: '';
    position: absolute;
    left: 50%;
    top: 11%;
    width: 3px;
    height: 78%;
    transform: translateX(-50%);
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(99, 116, 255, .1), rgba(72, 186, 148, .48), rgba(99, 116, 255, .1));
    box-shadow: 0 0 0 1px rgba(255, 255, 255, .6), 0 14px 30px rgba(72, 186, 148, .16);
    transition:
      width @transition-fast,
      height @transition-fast,
      opacity @transition-fast,
      background-color @transition-fast,
      box-shadow @transition-fast;
  }

  &:after {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    width: @comment-resize-handle-width;
    height: 100%;
    transform: translateX(-50%);
  }

  &:hover,
  &.commentResizeHandleActive {
    opacity: 1;

    &:before {
      width: 5px;
      height: 84%;
      background: linear-gradient(180deg, rgba(99, 116, 255, .18), rgba(72, 186, 148, .72), rgba(99, 116, 255, .18));
      box-shadow: 0 0 0 1px rgba(255, 255, 255, .75), 0 18px 34px rgba(72, 186, 148, .24);
    }
  }
}

:global(.q-comment-resizing) {
  cursor: col-resize !important;
  user-select: none !important;

  * {
    cursor: col-resize !important;
    user-select: none !important;
  }

  :global(.right),
  :global(.comment) {
    transition: none !important;
  }
}

.classic {
  color: var(--color-font);
  background-color: #fbfcf7;

  .bg {
    background:
      linear-gradient(110deg, rgba(211, 225, 255, .86) 0%, rgba(245, 252, 242, .9) 48%, rgba(255, 249, 222, .86) 100%),
      var(--play-detail-cover) center / cover no-repeat,
      var(--background-image) var(--background-image-position) / var(--background-image-size) no-repeat;
    filter: blur(42px) saturate(1.18);
    transform: scale(1.08);
    opacity: .58;

    &:before {
      background:
        radial-gradient(circle at 24% 62%, rgba(111, 139, 255, .26), transparent 36%),
        radial-gradient(circle at 72% 42%, rgba(252, 238, 174, .34), transparent 36%),
        linear-gradient(135deg, rgba(250, 253, 255, .72), rgba(255, 255, 248, .86));
    }

    &:after {
      background: linear-gradient(180deg, rgba(255, 255, 255, .36), rgba(255, 255, 255, .68) 58%, rgba(255, 255, 248, .92));
    }
  }

  .detailBackBtn {
    color: rgba(54, 58, 60, .72);
    border-color: rgba(54, 58, 60, .1);
    background: rgba(255, 255, 255, .56);

    &:hover {
      color: var(--color-font);
      background: rgba(255, 255, 255, .86);
    }
  }

  .albumStage {
    &:before {
      background: radial-gradient(ellipse at center, rgba(78, 96, 118, .14), rgba(78, 96, 118, .06) 44%, transparent 72%);
      opacity: .62;
    }
  }

  .record {
    overflow: visible;
    border: none;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, rgba(33, 39, 35, .96) 0 18%, rgba(73, 79, 75, .76) 19% 20%, transparent 21%),
      repeating-radial-gradient(circle, rgba(255, 255, 255, .16) 0 1px, rgba(0, 0, 0, .08) 2px 4px),
      radial-gradient(circle, #8f9490, #545956 72%, #2f3532);
    box-shadow: inset 0 0 34px rgba(255, 255, 255, .2), 0 18px 38px rgba(47, 60, 72, .18);

    &:before {
      display: none;
    }

    &:after {
      content: '';
      position: absolute;
      z-index: 1;
      width: 44%;
      height: 44%;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 255, 255, .96), rgba(232, 238, 232, .76));
      box-shadow: inset 0 0 0 10px rgba(19, 26, 22, .82);
    }
  }

  .img,
  .emptyCover {
    z-index: 2;
    width: 40%;
    height: 40%;
    border-radius: 50%;
    box-shadow: 0 10px 28px rgba(22, 28, 34, .24);
  }

  .emptyCover {
    color: rgba(38, 47, 43, .76);
    background: linear-gradient(145deg, rgba(255, 255, 252, .98), rgba(225, 233, 228, .94));
  }

  .emptyCoverMark {
    width: 42%;
    height: 42%;
  }

  .description {
    text-align: center;
    color: var(--color-font-label);

    p {
      color: var(--color-font-label);

      &:first-child {
        color: var(--color-font);
        font-size: 17px;
      }
    }
  }
}

</style>
