<template>
  <div :class="['q-player-footer', $style.footer, { [$style.detailFooter]: isImmersiveDetail, [$style.commentVisible]: isImmersiveDetail && isShowPlayComment }]">
    <div :class="$style.trackInfo">
      <button
        type="button"
        :class="$style.coverBtn"
        :aria-label="props.detail ? $t('player__hide_detail_tip') : $t('player__pic_tip')"
        @mousedown.stop
        @pointerdown.stop
        @click.stop="toggleDetail"
      >
        <img v-if="musicInfo.pic" :src="musicInfo.pic" decoding="async" @error="handleImgError">
        <empty-cover-mark v-else :class="$style.coverPlaceholder" />
        <span :class="[$style.coverHint, { [$style.coverHintFlip]: props.detail }]" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M6 14l6-6 6 6" />
          </svg>
        </span>
      </button>
      <div :class="$style.trackText">
        <div :class="$style.trackTitle">{{ title || status }}</div>
        <div :class="$style.trackMeta">{{ artist }}</div>
      </div>
    </div>
    <div :class="['q-player-center-control', $style.centerControl]">
      <div :class="$style.playControl">
        <button type="button" :class="$style.playBtn" :aria-label="$t('player__prev')" @click="playPrev()">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6.5" y="7" width="2.5" height="10" rx="1.25" />
            <path d="M17.6 7.65c.65-.43 1.4.04 1.4.82v7.06c0 .78-.75 1.25-1.4.82l-6.04-3.53a.95.95 0 0 1 0-1.64z" />
          </svg>
        </button>
        <button type="button" :class="[$style.playBtn, $style.playBtnPrimary]" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click="togglePlay">
          <svg v-if="isPlay" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="7.6" y="6.4" width="3.4" height="11.2" rx="1.6" />
            <rect x="13" y="6.4" width="3.4" height="11.2" rx="1.6" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.1 6.7c0-.86.94-1.39 1.68-.95l8.08 4.82a1.65 1.65 0 0 1 0 2.86l-8.08 4.82c-.74.44-1.68-.09-1.68-.95z" />
          </svg>
        </button>
        <button type="button" :class="$style.playBtn" :aria-label="$t('player__next')" @click="playNext()">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="15" y="7" width="2.5" height="10" rx="1.25" />
            <path d="M6.4 7.65C5.75 7.22 5 7.69 5 8.47v7.06c0 .78.75 1.25 1.4.82l6.04-3.53a.95.95 0 0 0 0-1.64z" />
          </svg>
        </button>
      </div>
      <div :class="$style.progressRow">
        <span :class="$style.timeLabel">{{ nowPlayTimeStr }}</span>
        <div :class="$style.progressContent">
          <common-progress-bar
            :class-name="$style.progress"
            :progress="progress"
            :handle-transition-end="handleTransitionEnd"
            :is-active-transition="isActiveTransition"
          />
        </div>
        <span :class="$style.timeLabel">{{ maxPlayTimeStr }}</span>
      </div>
    </div>
    <div :class="$style.toolArea">
      <control-btns :class="$style.tools" :detail="isImmersiveDetail" />
      <button
        type="button"
        :class="[$style.queueBtn, { [$style.active]: isShowPlayQueue }]"
        :aria-label="$t('play_queue__title')"
        :aria-expanded="isShowPlayQueue"
        :title="$t('play_queue__title')"
        @click.stop="togglePlayQueue"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h12" />
          <path d="M4 11h12" />
          <path d="M4 16h8" />
          <path d="M17 14v6" />
          <path d="M17 14l4 2.5-4 2.5" />
        </svg>
        <span v-if="tempPlayList.length" :class="$style.queueBadge">{{ queueBadgeText }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { playNext, playPrev, togglePlay } from '@renderer/core/player'
import { computed } from '@common/utils/vueTools'
import { status, isPlay, isShowPlayComment, isShowPlayQueue, musicInfo, tempPlayList } from '@renderer/store/player/state'
import { setMusicInfo, setShowPlayerDetail, setShowPlayQueue } from '@renderer/store/player/action'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import { appSetting } from '@renderer/store/setting'

import ControlBtns from './PlayDetail/components/ControlBtns.vue'
import EmptyCoverMark from '@renderer/components/common/EmptyCoverMark.vue'

const props = defineProps({
  detail: {
    type: Boolean,
    default: true,
  },
})

const {
  nowPlayTimeStr,
  maxPlayTimeStr,
  progress,
  isActiveTransition,
  handleTransitionEnd,
} = usePlayProgress()

// 歌手已在第二行单独展示，标题只显示歌名，避免拼接后被截断
const title = computed(() => musicInfo.name || '')
const artist = computed(() => musicInfo.singer || status.value || '')
const queueBadgeText = computed(() => tempPlayList.length > 99 ? '99+' : String(tempPlayList.length))
const isImmersiveDetail = computed(() => props.detail && appSetting['playDetail.style.layout'] == 'immersive')

const toggleDetail = () => {
  setShowPlayerDetail(!props.detail)
}

const togglePlayQueue = () => {
  setShowPlayQueue(!isShowPlayQueue.value)
}

const handleImgError = () => {
  setMusicInfo({ pic: null })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.footer {
  position: relative;
  z-index: 2;
  flex: 0 0 calc(@height-player - 18px);
  height: calc(@height-player - 18px);
  overflow: hidden;
  display: grid;
  // 左右两列同样的 minmax 约束 + 对称外边距，保证中间控制簇真正居中
  grid-template-columns: minmax(336px, 1fr) minmax(430px, 540px) minmax(336px, 1fr);
  column-gap: clamp(18px, 2.3vw, 34px);
  align-items: center;
  margin: 0 clamp(28px, 3vw, 50px) 18px;
  padding: 8px 16px;
  pointer-events: auto;
  box-sizing: border-box;
  -webkit-app-region: no-drag;
  border-radius: 24px;
  color: var(--color-font);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .78), rgba(241, 250, 246, .58)),
    rgba(255, 255, 255, .54);
  border: 1px solid rgba(54, 83, 70, .17);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .78),
    inset 0 -1px 0 rgba(54, 83, 70, .12),
    inset 0 0 0 1px rgba(255, 255, 255, .42),
    0 18px 42px rgba(54, 83, 70, .14);
  backdrop-filter: blur(26px) saturate(1.22);

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
    box-shadow:
      inset 0 0 0 1px rgba(54, 83, 70, .08),
      inset -1px 0 0 rgba(54, 83, 70, .08);
  }
}

.trackInfo {
  width: 100%;
  justify-self: start;
  min-width: 0;
  height: 64px;
  padding: 4px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-font);
}
.coverBtn {
  position: relative;
  flex: none;
  width: 52px;
  height: 52px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: none;
  border-radius: 14px;
  color: rgba(45, 54, 50, .72);
  cursor: pointer;
  pointer-events: auto;
  -webkit-app-region: no-drag;
  background: rgba(250, 252, 251, .78);
  border: 1px solid rgba(54, 83, 70, .14);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .84),
    0 8px 18px rgba(50, 63, 82, .1);
  transition: transform @transition-fast, box-shadow @transition-fast, opacity @transition-fast;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px rgba(50, 63, 82, .18);

    .coverHint {
      opacity: 1;
    }
  }

  &:active {
    transform: scale(.96);
    opacity: .88;
  }
}
.coverPlaceholder {
  width: 30px;
  height: 30px;
  color: rgba(42, 55, 49, .7);
}
.coverHint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(31, 40, 36, .34);
  opacity: 0;
  transition: opacity @transition-fast;
  pointer-events: none;

  svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: #fff;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform @transition-fast;
  }
}
.coverHintFlip {
  svg {
    transform: rotate(180deg);
  }
}
.trackText {
  min-width: 0;
  flex: auto;
}
.trackTitle {
  max-width: 100%;
  line-height: 1.4;
  font-size: 15px;
  font-weight: 700;
  .mixin-ellipsis-1();
}
.trackMeta {
  max-width: 100%;
  margin-top: 6px;
  line-height: 1.35;
  font-size: 13px;
  color: rgba(54, 58, 60, .62);
  .mixin-ellipsis-1();
}

.centerControl {
  position: relative;
  width: 100%;
  justify-self: center;
  min-width: 0;
  height: 64px;
  padding: 2px 10px 6px;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
}

.progressContent {
  position: relative;
  height: 12px;
  padding: 5px 0;
  width: 100%;
}
.progress {
  --q-progress-track-color: rgba(49, 55, 59, .12);
  --q-progress-bar-color: var(--color-primary);
  --q-progress-drag-color: var(--color-primary-dark-100);
  height: 100%;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .3);
}

.barTransition {
  transition-property: transform;
  transition-timing-function: ease-out;
  transition-duration: 0.2s;
}
.timeLabel {
  font-size: 12px;
  line-height: 1;
  color: rgba(49, 55, 59, .62);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.progressRow {
  position: relative;
  width: 100%;
  height: 16px;
  margin-top: 7px;
  display: grid;
  grid-template-columns: 46px minmax(130px, 1fr) 46px;
  align-items: center;
  gap: 10px;

  // 当前播放时间比总时长略重一档，一眼锁定
  .timeLabel:first-child {
    color: var(--color-font);
    font-weight: 600;
  }
}

.playControl {
  flex: none;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-font);
  gap: 14px;
}
.playBtn {
  width: 34px;
  height: 34px;
  padding: 0;
  flex: none;
  color: currentColor;
  border: none;
  background: transparent;
  transition: opacity .2s ease, background-color @transition-fast, color @transition-fast, transform @transition-fast;
  opacity: .76;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;

  svg {
    width: 20px;
    height: 20px;
    display: block;
    flex: none;
    fill: currentColor;
    stroke: none;
  }
  &:hover {
    opacity: 1;
    color: var(--color-primary);
    background-color: var(--color-primary-alpha-900);
    transform: scale(1.06);
  }
  &:active {
    opacity: 0.82;
    transform: scale(.96);
  }
}

.playBtnPrimary {
  width: 44px;
  height: 44px;
  color: var(--color-font);
  background: transparent;
  box-shadow: none;
  opacity: 1;

  svg {
    width: 25px;
    height: 25px;
  }

  &:hover {
    color: var(--color-primary);
    background: var(--color-primary-alpha-900);
    box-shadow: none;
    transform: scale(1.06);
  }
  &:active {
    transform: scale(.95);
  }
}

.toolArea {
  width: 100%;
  justify-self: end;
  align-self: center;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  padding-bottom: 0;
  -webkit-app-region: no-drag;
}

.tools {
  min-width: 0;
  flex: auto;
}

.queueBtn {
  position: relative;
  width: 30px;
  height: 30px;
  padding: 0;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  color: var(--color-font);
  background-color: transparent;
  cursor: pointer;
  opacity: .76;
  transition: opacity @transition-normal, color @transition-fast, background-color @transition-fast, transform @transition-fast;

  &:hover,
  &.active {
    opacity: 1;
    color: var(--color-primary);
    background-color: var(--q-icon-btn-hover-bg);
  }

  &:active {
    transform: scale(.94);
  }

  svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.queueBadge {
  position: absolute;
  top: -3px;
  right: -4px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 2px solid rgba(248, 253, 250, .96);
  border-radius: 8px;
  color: #fff;
  background-color: #45a77f;
  font-size: 9px;
  line-height: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.detailFooter {
  position: fixed;
  inset: auto 0 0;
  z-index: 12;
  display: block;
  width: 100%;
  height: 132px;
  margin: 0;
  padding: 0;
  overflow: visible;
  color: rgba(255, 255, 255, .94);
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  backdrop-filter: none;
  pointer-events: none;

  &:before {
    display: none;
  }

  .trackInfo {
    display: none;
  }

  .centerControl {
    position: fixed;
    left: clamp(76px, 8vw, 132px);
    bottom: 28px;
    width: clamp(410px, 34vw, 570px);
    height: 94px;
    padding: 0;
    box-sizing: border-box;
    overflow: visible;
    border: none;
    border-radius: 0;
    color: rgba(255, 255, 255, .94);
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    pointer-events: auto;
    transition: opacity .36s ease, transform .46s cubic-bezier(.22, 1, .36, 1);
  }

  .playControl {
    position: relative;
    z-index: 1;
    height: 48px;
    gap: clamp(26px, 2.7vw, 42px);
    color: rgba(255, 255, 255, .94);
  }

  .playBtn {
    width: 40px;
    height: 40px;
    color: rgba(255, 255, 255, .78);
    opacity: 1;

    svg {
      width: 24px;
      height: 24px;
    }

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, .09);
      transform: scale(1.08);
    }
  }

  .playBtnPrimary {
    width: 54px;
    height: 54px;
    color: #fff;
    background: transparent;
    border: none;
    box-shadow: none;
    backdrop-filter: none;

    svg {
      width: 30px;
      height: 30px;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, .28));
    }

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, .1);
      box-shadow: none;
      transform: scale(1.08);
    }
  }

  .progressRow {
    position: relative;
    z-index: 1;
    grid-template-columns: 38px minmax(130px, 1fr) 38px;
    gap: 9px;
    margin-top: 7px;
  }

  .timeLabel,
  .progressRow .timeLabel:first-child {
    color: rgba(255, 255, 255, .62);
  }

  .progress {
    --q-progress-track-color: rgba(255, 255, 255, .24);
    --q-progress-bar-color: rgba(255, 255, 255, .94);
    --q-progress-drag-color: #fff;
    box-shadow: none;
  }

  .toolArea {
    position: fixed;
    right: clamp(34px, 4.4vw, 68px);
    bottom: 34px;
    width: auto;
    max-width: min(48vw, 620px);
    height: 48px;
    padding: 0 9px;
    box-sizing: border-box;
    gap: 1px;
    overflow: hidden;
    isolation: isolate;
    border: none;
    border-radius: 24px;
    color: rgba(255, 255, 255, .86);
    background:
      linear-gradient(145deg, rgba(255, 255, 255, .12), rgba(255, 255, 255, .025) 52%, rgba(7, 12, 16, .14)),
      rgba(18, 23, 27, .18);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, .2),
      inset 0 -1px 0 rgba(255, 255, 255, .045),
      0 18px 48px rgba(0, 0, 0, .2);
    backdrop-filter: blur(30px) saturate(1.45) brightness(1.08);
    pointer-events: auto;
    transition: opacity .36s ease, transform .46s cubic-bezier(.22, 1, .36, 1);

    &:before {
      content: '';
      position: absolute;
      z-index: -1;
      inset: 0;
      border-radius: inherit;
      background:
        radial-gradient(110% 130% at 8% -35%, rgba(255, 255, 255, .22), transparent 48%),
        radial-gradient(100% 120% at 100% 135%, rgba(133, 205, 191, .1), transparent 56%);
      pointer-events: none;
    }
  }

  .tools {
    flex: none;
  }

  .queueBtn {
    color: rgba(255, 255, 255, .86);

    &:hover,
    &.active {
      color: #fff;
      background: rgba(255, 255, 255, .12);
    }
  }

  .queueBadge {
    border-color: rgba(18, 22, 25, .82);
  }
}

:global(body.immersive-controls-hidden) .detailFooter {
  .centerControl,
  .toolArea {
    opacity: 0;
    visibility: hidden;
    transform: translateY(22px) scale(.98);
    pointer-events: none;
    transition:
      opacity .3s ease,
      visibility 0s linear .3s,
      transform .42s cubic-bezier(.22, 1, .36, 1);
  }
}

.detailFooter.commentVisible {
  .toolArea {
    display: none;
  }

  .centerControl {
    // 评论三栏布局中播放条只占封面列，不再伸入中间歌词列。
    left: clamp(42px, 5vw, 82px);
    width: clamp(230px, 22vw, 320px);
  }
}

@media (max-width: 1280px) {
  .footer {
    grid-template-columns: minmax(0, 1fr) minmax(360px, 460px) minmax(306px, 1fr);
    column-gap: 16px;
    margin: 0 20px 16px clamp(22px, 3vw, 44px);
    padding-inline: 14px;
  }

  .trackInfo {
    gap: 10px;
  }

  .trackTitle {
    font-size: 14px;
  }

  .toolArea {
    gap: 2px;
  }

  .queueBtn {
    width: 28px;
    height: 28px;
  }
}

@media (max-width: 980px) {
  .footer {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 380px) minmax(258px, 1fr);
    column-gap: 10px;
    margin: 0 18px 14px 16px;
  }

  .trackInfo {
    gap: 9px;
  }

  .coverBtn {
    width: 48px;
    height: 48px;
  }

  .toolArea {
    gap: 1px;
  }

  .queueBtn {
    width: 24px;
    height: 24px;

    svg {
      width: 20px;
      height: 20px;
    }
  }
}
</style>
