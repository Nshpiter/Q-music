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
    <control-btns :class="$style.tools" />
  </div>
</template>

<script setup>
import { playNext, playPrev, togglePlay } from '@renderer/core/player'
import { computed } from '@common/utils/vueTools'
import { formatMusicName } from '@renderer/utils'
import { appSetting } from '@renderer/store/setting'
import { status, isPlay, musicInfo } from '@renderer/store/player/state'
import { setMusicInfo, setShowPlayerDetail } from '@renderer/store/player/action'
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

const title = computed(() => {
  return musicInfo.name
    ? formatMusicName(appSetting['download.fileName'], musicInfo.name, musicInfo.singer)
    : ''
})
const artist = computed(() => musicInfo.singer || status.value || '')

const toggleDetail = () => {
  setShowPlayerDetail(!props.detail)
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
  grid-template-columns: minmax(0, 1fr) minmax(430px, 560px) minmax(0, 1fr);
  column-gap: clamp(18px, 2.3vw, 34px);
  align-items: center;
  margin: 0 clamp(48px, 5vw, 78px) 14px;
  padding: 8px 16px;
  pointer-events: auto;
  box-sizing: border-box;
  -webkit-app-region: no-drag;
  border-radius: 28px;
  color: var(--color-font);
  background: rgba(255, 255, 255, .56);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .66), 0 18px 42px rgba(74, 86, 100, .1);
  backdrop-filter: blur(16px);
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
  }

  &:active {
    transform: scale(.96);
    opacity: .88;
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

.tools {
  width: 100%;
  justify-self: end;
  align-self: center;
  min-width: 0;
  padding-bottom: 0;
  -webkit-app-region: no-drag;
}

@media (max-width: 1280px) {
  .footer {
    grid-template-columns: minmax(0, 1fr) minmax(380px, 500px) minmax(0, 1fr);
    column-gap: 16px;
    margin-inline: clamp(22px, 3vw, 44px);
    padding-inline: 14px;
    margin-bottom: 12px;
  }

  .trackInfo {
    gap: 10px;
  }

  .trackTitle {
    font-size: 14px;
  }
}

@media (max-width: 980px) {
  .footer {
    grid-template-columns: minmax(0, .92fr) minmax(320px, 420px) minmax(0, 1fr);
    column-gap: 10px;
    margin-inline: 16px;
    margin-bottom: 10px;
  }

  .trackInfo {
    gap: 9px;
  }

  .coverBtn {
    width: 48px;
    height: 48px;
  }
}
</style>
