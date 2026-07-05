<template>
  <material-popup-btn :class="$style.btnContent">
    <button :class="$style.btn" :aria-label="isMute ? $t('player__volume_muted') : `${$t('player__volume')}${parseInt(volume * 100)}%`" @wheel="handleWheel">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10v4h3l4 3V7l-4 3H4z" />
        <path v-if="isMute || volume == 0" d="M16 9l4 6" />
        <path v-if="isMute || volume == 0" d="M20 9l-4 6" />
        <path v-else-if="volume < 0.45" d="M16 10.5a3 3 0 0 1 0 3" />
        <template v-else>
          <path d="M16 10.5a3 3 0 0 1 0 3" />
          <path d="M18.5 8a6 6 0 0 1 0 8" />
        </template>
      </svg>
    </button>
    <template #content>
      <div :class="$style.setting">
        <div :class="$style.info">
          <span>{{ Math.trunc(volume * 100) }}%</span>
          <base-checkbox
            id="player__volume_mute"
            :model-value="isMute"
            :label="$t('player__volume_mute_label')"
            @update:model-value="saveVolumeIsMute($event)"
          />
        </div>
        <base-slider-bar :class="$style.slider" :value="volume" :min="0" :max="1" :step="0.01" @change="handleUpdateVolume" />
      </div>
    </template>
  </material-popup-btn>
</template>

<script setup>
// import useNextTogglePlay from '@renderer/utils/compositions/useNextTogglePlay'
// import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
// import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { saveVolumeIsMute } from '@renderer/store/setting'
import { volume, isMute } from '@renderer/store/player/volume'

const handleWheel = (event) => {
  window.app_event.setVolume(Math.round(volume.value * 100 + (-event.deltaY / 100 * 2)) / 100)
}

const handleUpdateVolume = (val) => {
  window.app_event.setVolume(val)
}

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
  transition: color @transition-normal, background-color @transition-fast, opacity @transition-fast;
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
    filter: none;
  }
  &:hover {
    background-color: var(--color-primary-light-600-alpha-300);
    svg {
      opacity: 1;
    }
  }
  &:active {
    svg {
      opacity: 1;
    }
  }
}

.setting {
  display: flex;
  flex-flow: column nowrap;
  padding: 2px 3px;
  gap: 8px;
  width: 140px;
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

.slider {
  width: 100%;
}

</style>
