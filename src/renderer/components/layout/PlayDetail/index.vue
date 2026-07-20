<template lang="pug">
transition(enter-active-class="q-detail-enter-active" leave-active-class="q-detail-leave-active" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave")
  div(v-if="isShowPlayerDetail" :class="[$style.container, { fullscreen: isFullscreen }]" @contextmenu="handleContextMenu")
    div(:class="$style.bg" :style="detailBgStyle")
    //- div(:class="$style.bg" :style="bgStyle")
    //- div(:class="$style.bg2")
    ControlBtnsLeftHeader(v-if="appSetting['common.controlBtnPosition'] == 'left'")
    ControlBtnsRightHeader(v-else)
    div(ref="dom_main" :class="[$style.main, {[$style.showComment]: isCommentLayoutVisible, [$style.commentOpening]: isCommentLayoutOpening, [$style.commentGliding]: isCommentLayoutGliding, [$style.commentClosing]: isCommentLayoutClosing, [$style.commentSettling]: isCommentLayoutSettling}]" :style="mainStyle")
      div.left(:class="$style.left")
        div(ref="dom_record" :class="['q-album-stage', $style.albumStage, { [$style.albumStagePlaying]: isPlay }]")
          div(:class="$style.record")
            img(v-if="musicInfo.pic" :class="$style.img" :src="musicInfo.pic")
            div(v-else :class="$style.emptyCover") Q
          div(:class="$style.toneArm" aria-hidden="true")
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
  isPlay,
  musicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import { playProgress } from '@renderer/store/player/playProgress'
import {
  setShowPlayerDetail,
  setShowPlayComment,
  setShowPlayLrcSelectContentLrc,
} from '@renderer/store/player/action'
import LyricPlayer from './LyricPlayer.vue'
import MusicComment from './components/MusicComment/index.vue'
import ControlBtnsLeftHeader from './ControlBtnsLeftHeader.vue'
import ControlBtnsRightHeader from './ControlBtnsRightHeader.vue'
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
const RECORD_SPIN_SECONDS = 18
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
    let recordAnimationFrameId = null
    let recordSpinStartTime = 0
    let recordSpinStartPlayTime = 0
    let activePointerId = null
    let activeResizeType = null
    let resizeHandleElement = null
    let resizeStartX = 0
    let resizeStartWidth = 0
    let commentLayoutCloseTimer = null
    let commentLayoutGlideTimer = null
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

    const getRecordRotation = time => (time % RECORD_SPIN_SECONDS) / RECORD_SPIN_SECONDS * 360
    const setRecordRotation = rotation => {
      dom_record.value?.style.setProperty('--q-record-rotation', `${rotation}deg`)
    }
    const syncRecordRotation = () => {
      setRecordRotation(getRecordRotation(playProgress.nowPlayTime))
    }
    const stopRecordSpin = () => {
      if (!recordAnimationFrameId) return
      window.cancelAnimationFrame(recordAnimationFrameId)
      recordAnimationFrameId = null
    }
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
    const updateRecordSpin = () => {
      const elapsed = (window.performance.now() - recordSpinStartTime) / 1000
      setRecordRotation(getRecordRotation(recordSpinStartPlayTime + elapsed))
      recordAnimationFrameId = window.requestAnimationFrame(updateRecordSpin)
    }
    const startRecordSpin = () => {
      stopRecordSpin()
      recordSpinStartTime = window.performance.now()
      recordSpinStartPlayTime = playProgress.nowPlayTime
      syncRecordRotation()
      recordAnimationFrameId = window.requestAnimationFrame(updateRecordSpin)
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

    watch(isPlay, playing => {
      playing ? startRecordSpin() : stopRecordSpin()
    })

    watch(() => playProgress.nowPlayTime, () => {
      if (!isPlay.value) {
        syncRecordRotation()
        return
      }
      const elapsed = (window.performance.now() - recordSpinStartTime) / 1000
      if (Math.abs(playProgress.nowPlayTime - (recordSpinStartPlayTime + elapsed)) > 1.2) startRecordSpin()
    })

    onMounted(() => {
      syncRecordRotation()
      if (isPlay.value) startRecordSpin()
      window.addEventListener('resize', updateMainWidth)
    })

    onBeforeUnmount(() => {
      stopRecordSpin()
      clearCommentLayoutCloseTimer()
      clearCommentLayoutGlideTimer()
      clearFlipAnimations()
      stopCommentResize()
      window.removeEventListener('resize', updateMainWidth)
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
      isPlay,
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
  background-color: #fbfcf7;
  z-index: 10;
  // -webkit-app-region: drag;
  overflow: hidden;
  border-radius: @radius-border;
  color: var(--color-font);
  // border-left: 12px solid var(--color-primary-alpha-900);
  -webkit-app-region: no-drag;
  contain: strict;
  padding-bottom: 0;

  box-sizing: border-box;

  * {
    box-sizing: border-box;
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
    linear-gradient(110deg, rgba(211, 225, 255, .86) 0%, rgba(245, 252, 242, .9) 48%, rgba(255, 249, 222, .86) 100%),
    var(--play-detail-cover) center / cover no-repeat,
    var(--background-image) var(--background-image-position) / var(--background-image-size) no-repeat;
  filter: blur(42px) saturate(1.18);
  transform: scale(1.08);
  opacity: .58;
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
      radial-gradient(circle at 24% 62%, rgba(111, 139, 255, .26), transparent 36%),
      radial-gradient(circle at 72% 42%, rgba(252, 238, 174, .34), transparent 36%),
      linear-gradient(135deg, rgba(250, 253, 255, .72), rgba(255, 255, 248, .86));
  }
  &:after {
    position: absolute;
    left: 0;
    top: 0;
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, rgba(255, 255, 255, .36), rgba(255, 255, 255, .68) 58%, rgba(255, 255, 248, .92));
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
  --normal-gap: clamp(48px, 7vw, 116px);
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
    left: 10%;
    right: 10%;
    bottom: 3%;
    z-index: 0;
    height: 22%;
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(ellipse at center, rgba(78, 96, 118, .14), rgba(78, 96, 118, .06) 44%, transparent 72%);
    filter: blur(24px);
    opacity: .62;
    transform: translateY(18px);
    transition: opacity .32s ease, transform @comment-layout-duration @comment-layout-easing;
  }

  &:hover {
    filter: saturate(1.04) brightness(1.01);
    transform: translate3d(0, -4px, 0) scale(1.01);

    &:before {
      opacity: .72;
      transform: translateY(20px) scale(1.02);
    }
  }

  &.albumStagePlaying {
    .record {
      &:before {
        will-change: transform;
      }
    }

    .img,
    .emptyCover {
      will-change: transform;
    }

    .toneArm {
      transform: rotate(8deg);
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
  border-radius: 34px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, .94), rgba(245, 248, 250, .8)),
    rgba(255, 255, 255, .86);
  border: 1px solid rgba(255, 255, 255, .62);
  box-shadow: 0 18px 44px rgba(76, 93, 122, .08), inset 0 1px 0 rgba(255, 255, 255, .9);

  &:before {
    content: '';
    position: absolute;
    width: 78%;
    height: 78%;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, rgba(33, 39, 35, .95) 0 18%, rgba(73, 79, 75, .72) 19% 20%, transparent 21%),
      conic-gradient(from 0deg, rgba(255, 255, 255, .14), transparent 8%, rgba(255, 255, 255, .08) 18%, transparent 31%, rgba(0, 0, 0, .12) 45%, transparent 62%, rgba(255, 255, 255, .1) 78%, transparent),
      repeating-radial-gradient(circle, rgba(255, 255, 255, .2) 0 1px, rgba(0, 0, 0, .08) 2px 4px),
      radial-gradient(circle, #8f9490, #545956 72%, #2f3532);
    box-shadow: inset 0 0 34px rgba(255, 255, 255, .2), 0 18px 38px rgba(47, 60, 72, .18);
    transform-origin: center;
    transform: rotate(var(--q-record-rotation, 0deg));
    will-change: transform;
  }

  &:after {
    content: '';
    position: absolute;
    width: 44%;
    height: 44%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, .96), rgba(232, 238, 232, .76));
    box-shadow: inset 0 0 0 10px rgba(19, 26, 22, .82);
  }
}
.img {
  position: relative;
  z-index: 2;
  width: 40%;
  height: 40%;
  object-fit: cover;
  border-radius: 50%;
  box-shadow: 0 10px 28px rgba(22, 28, 34, .26);
  transform-origin: center;
  transform: rotate(var(--q-record-rotation, 0deg));
  will-change: transform;
}
.emptyCover {
  position: relative;
  z-index: 2;
  width: 40%;
  height: 40%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 34px;
  font-weight: 700;
  background: linear-gradient(135deg, #6374ff, var(--color-primary));
  box-shadow: 0 10px 28px rgba(22, 28, 34, .24);
  transform-origin: center;
  transform: rotate(var(--q-record-rotation, 0deg));
  will-change: transform;
}
.toneArm {
  position: absolute;
  z-index: 3;
  right: 12%;
  top: -4%;
  width: 30%;
  height: 60%;
  transform: rotate(-11deg);
  transform-origin: 80% 12%;
  pointer-events: none;
  transition: transform .48s cubic-bezier(.16, 1, .3, 1);
  filter: drop-shadow(8px 12px 16px rgba(42, 50, 56, .2));
}

.toneArmBase {
  position: absolute;
  right: 10%;
  top: 2%;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid rgba(114, 129, 126, .22);
  background:
    radial-gradient(circle at 42% 38%, rgba(255, 255, 255, .96), rgba(230, 237, 234, .9) 38%, rgba(176, 190, 185, .84) 72%),
    #dce6e1;
  box-shadow:
    inset 0 0 0 8px rgba(224, 232, 229, .84),
    inset 0 -8px 14px rgba(74, 88, 86, .16),
    0 12px 28px rgba(48, 58, 66, .18);
}

.toneArmRod {
  position: absolute;
  right: 28%;
  top: 15%;
  width: 10px;
  height: 77%;
  border-radius: 999px;
  transform: rotate(13deg);
  transform-origin: 50% 8%;
  background:
    linear-gradient(90deg, rgba(118, 132, 132, .7), rgba(248, 251, 250, .96) 24%, rgba(151, 164, 164, .94) 50%, rgba(236, 241, 239, .92) 78%, rgba(91, 105, 106, .62)),
    #c8d2cf;
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, .78),
    inset -2px 0 0 rgba(66, 78, 80, .22),
    5px 10px 18px rgba(46, 56, 64, .18);
}

.toneArmHead {
  position: absolute;
  right: 43%;
  bottom: 5%;
  width: 34px;
  height: 24px;
  border-radius: 10px 10px 12px 12px;
  border: 1px solid rgba(103, 116, 116, .24);
  transform: rotate(25deg);
  transform-origin: 70% 20%;
  background:
    linear-gradient(160deg, rgba(247, 250, 249, .95), rgba(178, 190, 189, .86)),
    #cfdad6;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .82),
    inset 0 -5px 9px rgba(65, 82, 82, .18),
    5px 8px 16px rgba(38, 48, 56, .2);

  &:after {
    content: '';
    position: absolute;
    left: 7px;
    bottom: -9px;
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 11px solid rgba(51, 60, 62, .82);
    transform: rotate(-8deg);
    filter: drop-shadow(2px 3px 3px rgba(38, 48, 56, .28));
  }
}

.description {
  width: min(100%, 430px);
  max-height: 92px;
  margin-top: 22px;
  padding: 0 8px;
  text-align: center;
  color: var(--color-font-label);
  transition:
    width @comment-layout-duration @comment-layout-easing,
    margin-top @comment-layout-duration @comment-layout-easing,
    opacity @transition-fast,
    transform @comment-layout-duration @comment-layout-easing;
  p {
    line-height: 1.55;
    font-size: 14px;
    overflow-wrap: break-word;
    color: var(--color-font-label);
    .mixin-ellipsis-1();

    &:first-child {
      color: var(--color-font);
      font-size: 17px;
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

</style>
