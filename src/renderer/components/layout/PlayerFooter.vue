<template>
  <div :class="['q-player-footer', $style.footer]">
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
        <span v-else>Q</span>
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
            <path d="M7 6v12" />
            <path d="M18 6l-8 6 8 6V6z" />
          </svg>
        </button>
        <button type="button" :class="[$style.playBtn, $style.playBtnPrimary]" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click="togglePlay">
          <svg v-if="isPlay" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 7v10" />
            <path d="M15 7v10" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6.5v11l9-5.5-9-5.5z" />
          </svg>
        </button>
        <button type="button" :class="$style.playBtn" :aria-label="$t('player__next')" @click="playNext()">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17 6v12" />
            <path d="M6 6l8 6-8 6V6z" />
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
      <control-btns :class="$style.tools" />
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
import { status, isPlay, isShowPlayQueue, musicInfo, tempPlayList } from '@renderer/store/player/state'
import { setMusicInfo, setShowPlayerDetail, setShowPlayQueue } from '@renderer/store/player/action'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'

import ControlBtns from './PlayDetail/components/ControlBtns.vue'

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
  grid-template-columns: minmax(0, 1fr) minmax(430px, 540px) minmax(336px, 1fr);
  column-gap: clamp(18px, 2.3vw, 34px);
  align-items: center;
  margin: 0 22px 18px clamp(48px, 5vw, 78px);
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
  color: #fff;
  cursor: pointer;
  pointer-events: auto;
  -webkit-app-region: no-drag;
  background: linear-gradient(135deg, #6573ff, #48ba94);
  box-shadow: 0 10px 22px rgba(50, 63, 82, .14);
  transition: transform @transition-fast, box-shadow @transition-fast, opacity @transition-fast;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  span {
    font-size: 16px;
    font-weight: 700;
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
  --q-progress-track-color: rgba(49, 55, 59, .14);
  --q-progress-bar-color: #4f6b62;
  --q-progress-drag-color: rgba(79, 107, 98, .62);
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
}

.playControl {
  flex: none;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: rgba(49, 55, 59, .86);
  gap: 16px;
}
.playBtn {
  width: 30px;
  height: 30px;
  padding: 0;
  flex: none;
  color: currentColor;
  border: none;
  background: transparent;
  transition: opacity 0.2s ease, background-color @transition-fast, color @transition-fast, transform @transition-fast;
  opacity: 1;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;

  svg {
    width: 18px;
    height: 18px;
    display: block;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.3;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  &:hover {
    opacity: 1;
    color: rgba(29, 34, 38, .95);
    background-color: rgba(49, 55, 59, .07);
  }
  &:active {
    opacity: 0.82;
    transform: scale(.96);
  }
}

.playBtnPrimary {
  width: 38px;
  height: 38px;
  color: #fff;
  background: #31373b;
  box-shadow: 0 10px 22px rgba(49, 55, 59, .17);

  &:hover {
    color: #fff;
    background: #24292d;
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
  color: rgba(29, 34, 38, .7);
  background-color: transparent;
  cursor: pointer;
  opacity: .82;
  transition: opacity @transition-normal, color @transition-fast, background-color @transition-fast, transform @transition-fast;

  &:hover,
  &.active {
    opacity: 1;
    color: var(--color-primary);
    background-color: var(--color-primary-background-hover);
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
