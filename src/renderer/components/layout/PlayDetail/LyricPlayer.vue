<template>
  <div :class="['right', $style.right, { [$style.commentMode]: isCommentLayoutVisible, [$style.layoutSettling]: commentLayoutSettling }]" :style="lrcFontSize">
    <div v-show="playerMusicInfo.name" :class="$style.trackHeader">
      <div :class="$style.trackName">{{ playerMusicInfo.name }}</div>
      <div :class="$style.trackArtist">{{ playerMusicInfo.singer }}</div>
    </div>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div
        v-show="!isShowLrcSelectContent"
        ref="dom_lyric"
        :class="['lyric', $style.lyric, { [$style.draging]: isMsDown }, { [$style.lrcActiveZoom]: isZoomActiveLrc }]" :style="lrcStyles"
        @wheel="handleWheel" @mousedown="handleLyricMouseDown" @touchstart="handleLyricTouchStart"
        @mousemove="handleLyricMouseMove"
        @contextmenu.stop="handleShowLyricMenu"
      >
        <div :class="['pre', $style.lyricSpace, $style.lyricSpaceTop]" />
        <div ref="dom_lyric_text" />
        <div :class="[$style.lyricSpace, $style.lyricSpaceBottom]" />
      </div>
    </transition>
    <div v-if="isShowNoLyric" :class="$style.noLyric">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18V5l10-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </svg>
      <p>{{ $t('player__no_lyric') }}</p>
    </div>
    <transition enter-active-class="animated-fast fadeIn" leave-active-class="animated-fast fadeOut">
      <button
        v-show="linePlayVisible && !isShowLrcSelectContent"
        type="button"
        :class="$style.linePlayBtn"
        :style="{ top: `${linePlayTop}px` }"
        :aria-label="linePlayTimeStr"
        ignore-tip
        @mousedown.stop
        @pointerdown.stop
        @mouseenter="handleLinePlayMouseEnter"
        @mouseleave="handleLinePlayMouseLeave"
        @click.stop="handleLinePlay"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6.5v11l9-5.5-9-5.5z" />
        </svg>
        <span>{{ linePlayTimeStr }}</span>
      </button>
    </transition>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="isShowLyricProgressSetting" v-show="isStopScroll && !isShowLrcSelectContent" :class="$style.skip">
        <div ref="dom_skip_line" :class="$style.line" />
        <span :class="$style.label">{{ timeStr }}</span>
        <base-btn :class="$style.skipBtn" @mouseenter="handleSkipMouseEnter" @mouseleave="handleSkipMouseLeave" @click="handleSkipPlay">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-play" />
          </svg>
        </base-btn>
      </div>
    </transition>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="isShowLrcSelectContent" ref="dom_lrc_select_content" tabindex="-1" :class="[$style.lyricSelectContent, 'select', 'scroll', 'lyricSelectContent']" @contextmenu="handleCopySelectText">
        <div v-for="(info, index) in lyric.lines" :key="index" :class="[$style.lyricSelectline, { [$style.lrcActive]: lyric.line == index }]">
          <span>{{ info.text }}</span>
          <template v-for="(lrc, i) in info.extendedLyrics" :key="i">
            <br>
            <span :class="$style.lyricSelectlineExtended">{{ lrc }}</span>
          </template>
        </div>
      </div>
    </transition>
    <LyricMenu v-model="lyricMenuVisible" :xy="lyricMenuXY" :lyric-info="lyricInfo" @update-lyric="handleUpdateLyric" />
  </div>
</template>

<script>
import { clipboardWriteText } from '@common/utils/electron'
import { lyric } from '@renderer/store/player/lyric'
import { playProgress } from '@renderer/store/player/playProgress'
import { isFullscreen } from '@renderer/store'
import {
  isPlay,
  isShowLrcSelectContent,
  isShowPlayComment,
  musicInfo as playerMusicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setMusicInfo,
} from '@renderer/store/player/action'
import { onMounted, onBeforeUnmount, computed, reactive, ref, nextTick, watch } from '@common/utils/vueTools'
import useLyric from '@renderer/utils/compositions/useLyric'
import LyricMenu from './components/LyricMenu.vue'
import { appSetting } from '@renderer/store/setting'
import { setLyricOffset } from '@renderer/core/lyric'
import useSelectAllLrc from './useSelectAllLrc'

export default {
  components: {
    LyricMenu,
  },
  props: {
    commentLayoutVisible: Boolean,
    commentLayoutSettling: Boolean,
  },
  setup(props) {
    const isShowNoLyric = computed(() => !!playerMusicInfo.id && !lyric.lines.length && !isShowLrcSelectContent.value)
    const isZoomActiveLrc = computed(() => appSetting['playDetail.isZoomActiveLrc'])
    const isShowLyricProgressSetting = computed(() => appSetting['playDetail.isShowLyricProgressSetting'])
    const isCommentLayoutVisible = computed(() => props.commentLayoutVisible || isShowPlayComment.value)

    const {
      dom_lyric,
      dom_lyric_text,
      dom_skip_line,
      isMsDown,
      isStopScroll,
      linePlayVisible,
      linePlayTop,
      linePlayTimeStr,
      timeStr,
      handleLyricMouseDown,
      handleLyricTouchStart,
      handleLyricMouseMove,
      handleWheel,
      handleSkipPlay,
      handleSkipMouseEnter,
      handleSkipMouseLeave,
      handleLinePlay,
      handleLinePlayMouseEnter,
      handleLinePlayMouseLeave,
      handleScrollLrc,
    } = useLyric({ isPlay, lyric, playProgress, isShowLyricProgressSetting, isShowPlayComment })

    const dom_lrc_select_content = useSelectAllLrc()

    const layoutScrollTimers = []
    let lyricResizeObserver = null
    let lyricResizeTimer = null
    const clearLayoutScrollTimers = () => {
      while (layoutScrollTimers.length) clearTimeout(layoutScrollTimers.pop())
    }
    const clearLyricResizeTimer = () => {
      if (!lyricResizeTimer) return
      clearTimeout(lyricResizeTimer)
      lyricResizeTimer = null
    }
    const syncLyricScrollOnResize = () => {
      if (!isShowPlayComment.value) return
      clearLyricResizeTimer()
      lyricResizeTimer = setTimeout(() => {
        lyricResizeTimer = null
        handleScrollLrc(0)
      }, 80)
    }
    const syncLyricScrollAfterLayout = () => {
      clearLayoutScrollTimers()
      clearLyricResizeTimer()
      void nextTick(() => {
        const delays = [60, 180, 360, 760, 1200]
        handleScrollLrc(0, true)
        for (const [index, delay] of delays.entries()) {
          const timer = setTimeout(() => {
            handleScrollLrc(index == delays.length - 1 ? 160 : 0)
          }, delay)
          layoutScrollTimers.push(timer)
        }
      })
    }

    watch([isFullscreen, isShowPlayComment], syncLyricScrollAfterLayout)

    const lyricMenuVisible = ref(false)
    const lyricMenuXY = reactive({
      x: 0,
      y: 0,
    })
    const lyricInfo = reactive({
      lyric: '',
      tlyric: '',
      rlyric: '',
      lxlyric: '',
      rawlyric: '',
      musicInfo: null,
    })
    const updateMusicInfo = () => {
      lyricInfo.lyric = playerMusicInfo.lrc
      lyricInfo.tlyric = playerMusicInfo.tlrc
      lyricInfo.rlyric = playerMusicInfo.rlrc
      lyricInfo.lxlyric = playerMusicInfo.lxlrc
      lyricInfo.rawlyric = playerMusicInfo.rawlrc
      lyricInfo.musicInfo = playMusicInfo.musicInfo
    }
    const handleShowLyricMenu = event => {
      updateMusicInfo()
      lyricMenuXY.x = event.pageX
      lyricMenuXY.y = event.pageY
      if (lyricMenuVisible.value) return
      void nextTick(() => {
        lyricMenuVisible.value = true
      })
    }
    const handleUpdateLyric = ({ lyric, tlyric, rlyric, lxlyric, offset }) => {
      setMusicInfo({
        lrc: lyric,
        tlrc: tlyric,
        rlrc: rlyric,
        lxlrc: lxlyric,
      })
      setLyricOffset(offset)
    }

    const lrcStyles = computed(() => {
      return {
        textAlign: appSetting['playDetail.style.align'],
      }
    })
    const lrcFontSize = computed(() => {
      let size = appSetting['playDetail.style.fontSize'] / 100
      if (isFullscreen.value) size = size *= 1.4
      return {
        '--playDetail-lrc-font-size': (isCommentLayoutVisible.value ? size * 0.82 : size) + 'rem',
        '--playDetail-lrc-space-top-height': isCommentLayoutVisible.value ? '8%' : '58%',
        '--playDetail-lrc-space-bottom-height': isCommentLayoutVisible.value ? '92%' : '58%',
      }
    })

    onMounted(() => {
      window.app_event.on('musicToggled', updateMusicInfo)
      window.app_event.on('lyricUpdated', updateMusicInfo)
      if (window.ResizeObserver) {
        lyricResizeObserver = new ResizeObserver(syncLyricScrollOnResize)
        if (dom_lyric.value) lyricResizeObserver.observe(dom_lyric.value)
        if (dom_lyric_text.value) lyricResizeObserver.observe(dom_lyric_text.value)
      }
    })
    onBeforeUnmount(() => {
      clearLayoutScrollTimers()
      clearLyricResizeTimer()
      lyricResizeObserver?.disconnect()
      window.app_event.off('musicToggled', updateMusicInfo)
      window.app_event.off('lyricUpdated', updateMusicInfo)
    })

    return {
      isShowNoLyric,
      dom_lyric,
      dom_lyric_text,
      dom_skip_line,
      dom_lrc_select_content,
      isMsDown,
      linePlayVisible,
      linePlayTop,
      linePlayTimeStr,
      timeStr,
      handleLyricMouseDown,
      handleLyricTouchStart,
      handleLyricMouseMove,
      handleWheel,
      handleSkipPlay,
      handleSkipMouseEnter,
      handleSkipMouseLeave,
      handleLinePlay,
      handleLinePlayMouseEnter,
      handleLinePlayMouseLeave,
      lyric,
      lrcStyles,
      lrcFontSize,
      isShowLrcSelectContent,
      isShowLyricProgressSetting,
      isShowPlayComment,
      isCommentLayoutVisible,
      isZoomActiveLrc,
      isStopScroll,
      playerMusicInfo,
      lyricMenuVisible,
      lyricMenuXY,
      handleShowLyricMenu,
      handleUpdateLyric,
      lyricInfo,
    }
  },
  methods: {
    handleCopySelectText() {
      let str = window.getSelection().toString()
      str = str.trim()
      if (!str.length) return
      clipboardWriteText(str)
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.right {
  flex: 1 1 0;
  height: 100%;
  max-width: 690px;
  padding: clamp(12px, 2.8vh, 32px) 0;
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  will-change: transform, opacity, width, max-width, padding;
  backface-visibility: hidden;
  transform: translateZ(0);
  transition:
    flex-basis .5s cubic-bezier(.22, 1, .36, 1),
    width .5s cubic-bezier(.22, 1, .36, 1),
    max-width .5s cubic-bezier(.22, 1, .36, 1),
    padding .5s cubic-bezier(.22, 1, .36, 1),
    opacity .28s ease,
    transform .5s cubic-bezier(.22, 1, .36, 1);
  min-width: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  overflow: visible;
}
.trackHeader {
  position: relative;
  z-index: 2;
  flex: none;
  margin-bottom: clamp(8px, 2vh, 18px);
  text-align: center;
  color: var(--color-font);
  transition: margin-bottom .5s cubic-bezier(.22, 1, .36, 1), opacity .28s ease, transform .5s cubic-bezier(.22, 1, .36, 1);
}
.trackName {
  max-width: 100%;
  font-size: clamp(20px, 2.1vw, 30px);
  line-height: 1.28;
  font-weight: 700;
  .mixin-ellipsis-1();
}
.trackArtist {
  margin-top: 6px;
  font-size: 16px;
  line-height: 1.3;
  color: rgba(54, 58, 60, .66);
  .mixin-ellipsis-1();
}
.lyric {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-height: 0;
  text-align: center;
  height: auto;
  overflow: hidden;
  font-size: var(--playDetail-lrc-font-size, 16px);
  -webkit-mask-image: linear-gradient(transparent 0%, #fff 16%,  #fff 78%, transparent 100%);
  cursor: grab;
  transition: opacity .28s ease, transform .5s cubic-bezier(.22, 1, .36, 1), -webkit-mask-image .5s ease;
  &.draging {
    cursor: grabbing;
  }
  :global {
    .font-lrc {
      color: rgba(54, 58, 60, .72);
    }
    .line-content {
      line-height: 1.26;
      padding: calc(var(--playDetail-lrc-font-size, 16px) / 2.15) 1px;
      overflow-wrap: break-word;
      color: rgba(54, 58, 60, .72);
      transition: @transition-normal;
      transition-property: color, padding, transform, opacity, text-shadow;
      opacity: .68;

      .extended {
        font-size: 0.8em;
        margin-top: 5px;
      }
      &.line-mode {
        .font-lrc {
          transition: @transition-fast;
          transition-property: font-size, color, text-shadow;
        }
      }
      &.line-mode.active .font-lrc, &.font-mode.played .font-lrc {
        color: #6374ff;
        text-shadow: 0 12px 34px rgba(99, 116, 255, .18);
      }
      &.line-mode.active {
        transform: scale(1.02);
        opacity: 1;
      }
      &.font-mode .extended .font-lrc {
        transition: @transition-slow;
        transition-property: font-size, color;
      }

      &.font-mode > .line > .font-lrc {
        > span {
          transition: @transition-normal;
          transition-property: font-size;
          font-size: 1em;
          background-repeat: no-repeat;
          background-color: rgba(54, 58, 60, .52);
          background-image: -webkit-linear-gradient(top, #6374ff, #6374ff);
          -webkit-text-fill-color: transparent;
          -webkit-background-clip: text;
          background-size: 0 100%;
        }
      }
    }
  }
  // p {
  //   padding: 8px 0;
  //   line-height: 1.2;
  //   overflow-wrap: break-word;
  //   transition: @transition-normal !important;
  //   transition-property: color, font-size;
  // }
  // .lrc-active {
  //   color: var(--color-primary);
  //   font-size: 1.2em;
  // }
}
.lrcActiveZoom {
  :global {
    .line-content {
      &.active {
        .extended {
          font-size: .94em;
        }
        .line {
          font-size: 1.1em;
        }
      }
    }
  }
}
.commentMode {
  .trackHeader {
    margin-bottom: clamp(6px, 1.6vh, 14px);
    transform: translateY(-2px);
  }

  .lyric {
    -webkit-mask-image: linear-gradient(transparent 0%, #fff 10%,  #fff 84%, transparent 100%);
    transform: translateY(-2px);
  }
}
.layoutSettling {
  transition: none !important;

  .trackHeader,
  .lyric,
  .lyricSelectContent {
    transition: none !important;
    animation: none !important;
  }

  :global {
    .line-content,
    .font-lrc {
      transition: none !important;
      animation: none !important;
    }
  }
}

.skip {
  position: absolute;
  top: calc(38% + var(--playDetail-lrc-font-size, 16px) + 4px);
  left: 0;
  // height: 6px;
  width: 100%;
  pointer-events: none;
  // opacity: .5;
  .line {
    border-top: 2px solid var(--color-primary);
    opacity: .22;
    margin-right: 30px;
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, transparent 15%, #fff 100%);
  }
  .label {
    position: absolute;
    right: 30px;
    top: -14px;
    line-height: 1.2;
    font-size: 12px;
    color: var(--color-primary);
    opacity: .86;
  }
  .skipBtn {
    position: absolute;
    right: 0;
    top: 0;
    transform: translateY(-50%);
    width: 30px;
    height: 30px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-alpha-900) !important;
    border-radius: 50%;
    pointer-events: initial;
    transition: @transition-normal;
    transition-property: opacity;
    opacity: .8;
    &:hover {
      opacity: .6;
    }
  }
}
.linePlayBtn {
  position: absolute;
  right: -86px;
  z-index: 4;
  width: 82px;
  height: 32px;
  padding: 0 10px 0 9px;
  border: 1px solid rgba(54, 58, 60, .12);
  border-radius: 999px;
  color: rgba(54, 58, 60, .86);
  background: rgba(255, 255, 255, .72);
  box-shadow: 0 10px 24px rgba(76, 90, 110, .12);
  backdrop-filter: blur(10px);
  transform: translateY(-50%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  -webkit-app-region: no-drag;
  transition: opacity @transition-fast, transform @transition-fast, box-shadow @transition-fast, background-color @transition-fast;

  svg {
    width: 15px;
    height: 15px;
    flex: none;
    fill: currentColor;
  }

  span {
    flex: none;
    min-width: 34px;
    font-size: 12px;
    line-height: 1;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: left;
  }

  &:hover {
    background: rgba(255, 255, 255, .88);
    transform: translateY(-50%) translateX(2px);
    box-shadow: 0 14px 30px rgba(76, 90, 110, .16);
  }

  &:active {
    transform: translateY(-50%) scale(.96);
    opacity: .86;
  }
}
.lyricSelectContent {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  // text-align: center;
  height: auto;
  width: 100%;
  font-size: var(--playDetail-lrc-font-size, 16px);
  z-index: 2;
  color: var(--color-font-label);
  padding: 14px 8px 18px;
  overflow-y: auto;
  border-radius: 24px;
  outline: none;
  background: rgba(255, 255, 255, .34);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .5);
  backdrop-filter: blur(12px);

  .lyricSelectline {
    padding: calc(var(--playDetail-lrc-font-size, 16px) / 1.7) 8px;
    overflow-wrap: break-word;
    transition: @transition-normal !important;
    transition-property: color, font-size;
    line-height: 1.35;
    border-radius: @radius-border;
  }
  .lyricSelectlineExtended {
    font-size: 14px;
  }
  .lrcActive {
    color: #6374ff;
    background: rgba(99, 116, 255, .1);
  }
}

.noLyric {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgba(54, 58, 60, .38);
  pointer-events: none;
  opacity: 0;
  // 延迟淡入，歌词正常加载时不闪现占位
  animation: qNoLyricIn .4s ease .6s forwards;

  svg {
    width: 34px;
    height: 34px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
  }
}

@keyframes qNoLyricIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.lyricSpace {
  height: 58%;
}
.lyricSpaceTop {
  height: var(--playDetail-lrc-space-top-height, 58%);
}
.lyricSpaceBottom {
  height: var(--playDetail-lrc-space-bottom-height, 58%);
}

</style>
