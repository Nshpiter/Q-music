<template>
  <material-popup-btn :class="$style.btnContent">
    <button :class="[$style.btn, { [$style.active]: playbackRate != 1 }]" :aria-label="`${$t('player__playback_rate')}${playbackRate}x`">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 17a8 8 0 1 1 14 0" />
        <path d="M12 13l4-4" />
        <path d="M8 17h8" />
      </svg>
    </button>
    <template #content>
      <div :class="$style.setting">
        <div :class="$style.info">
          <span>{{ playbackRate.toFixed(2) }}x</span>
          <div :class="$style.control">
            <base-checkbox
              id="player__playback_preserves_pitch"
              :model-value="appSetting['player.preservesPitch']"
              :label="$t('player__playback_preserves_pitch')"
              @update:model-value="updatePreservesPitch"
            />
            <base-btn min @click="handleUpdatePlaybackRate(100)">{{ $t('player__playback_rate_reset_btn') }}</base-btn>
          </div>
        </div>
        <base-slider-bar :class="$style.slider" :value="playbackRate * 100" :min="50" :max="200" @change="handleUpdatePlaybackRate" />
      </div>
    </template>
  </material-popup-btn>
</template>

<script setup>
// import { computed } from '@common/utils/vueTools'
import { playbackRate } from '@renderer/store/player/playbackRate'
import { appSetting, updateSetting } from '@renderer/store/setting'

const handleUpdatePlaybackRate = (val) => {
  window.app_event.setPlaybackRate(Math.round(val) / 100)
}


const updatePreservesPitch = (enabled) => {
  updateSetting({ 'player.preservesPitch': enabled })
}

// const icon = computed(() => {
//   return playbackRate.value == 0
//     ? '#icon-volume-off-outline'
//     : playbackRate.value < 0.3
//       ? '#icon-volume-low-outline'
//       : playbackRate.value < 0.7
//         ? '#icon-volume-medium-outline'
//         : '#icon-volume-high-outline'
// })

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.btnContent {
  flex: none;
  width: var(--q-footer-tool-size, 34px);
  height: var(--q-footer-tool-size, 34px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn {
  position: relative;
  // color: var(--color-button-font);
  justify-content: center;
  align-items: center;
  transition: color @transition-normal;
  cursor: pointer;
  background-color: transparent;
  border: none;
  width: var(--q-footer-tool-size, 34px);
  height: var(--q-footer-tool-size, 34px);
  display: flex;
  flex-flow: column nowrap;
  padding: 0;
  border-radius: 50%;

  svg {
    transition: opacity @transition-fast;
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: .72;
    // filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.2));
  }
  &:hover {
    svg {
      opacity: .9;
    }
  }
  &:active {
    svg {
      opacity: 1;
    }
  }

  &.active {
    svg {
      color: var(--color-primary);
      opacity: .8;
    }
  }
}

.setting {
  display: flex;
  flex-flow: column nowrap;
  padding: 2px 3px;
  gap: 8px;
  width: 300px;
}

.info {
  display: flex;
  flex-flow: row nowrap;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  span {
    line-height: 1.2;
  }
}
.control {
  align-items: center;
  display: flex;
  gap: 10px;
}

.slider {
  width: 100%;
}


</style>
