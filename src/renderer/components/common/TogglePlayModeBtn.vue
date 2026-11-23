<template>
  <material-popup-btn ref="btn_ref" :class="$style.btnContent">
    <button class="q-player-tool" :class="$style.btn" :aria-label="nextTogglePlayName">
      <svg v-if="['listLoop', 'singleLoop'].includes(appSetting['player.togglePlayMethod'])" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12v-2a3 3 0 0 1 3-3h12m-3-3 3 3-3 3m4 2v2a3 3 0 0 1-3 3H5m3-3-3 3 3 3" />
        <path v-if="appSetting['player.togglePlayMethod'] == 'singleLoop'" d="m10.8 11.1 1.8-1.1v4" />
      </svg>
      <svg v-else-if="appSetting['player.togglePlayMethod'] == 'random'" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h2c4.5 0 7.5 10 12 10h2m-3-3 3 3-3 3M4 17h2c1.6 0 3-1.2 4.3-3m3.4-4C15 8.3 16.5 7 18 7h2m-3-3 3 3-3 3" />
      </svg>
      <svg v-else-if="appSetting['player.togglePlayMethod'] == 'list'" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6.5h10M4 12h8m-8 5.5h6M18 5.5v13m-3-3 3 3 3-3" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5.5 5.5 10 6.5-10 6.5zM19 5.5v13" />
      </svg>
    </button>
    <template #content>
      <div :class="$style.setting">
        <button :class="$style.btn" :aria-label="$t('player__play_toggle_mode_list_loop')" @click="toggleMode('listLoop')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-list-loop" />
          </svg>
        </button>
        <button :class="$style.btn" :aria-label="$t('player__play_toggle_mode_random')" @click="toggleMode('random')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-list-random" />
          </svg>
        </button>
        <button :class="$style.btn" :aria-label="$t('player__play_toggle_mode_list')" @click="toggleMode('list')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 32 32" space="preserve">
            <use xlink:href="#icon-list-order" />
          </svg>
        </button>
        <button :class="$style.btn" :aria-label="$t('player__play_toggle_mode_single_loop')" @click="toggleMode('singleLoop')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-single-loop" />
          </svg>
        </button>
        <button :class="$style.btn" :aria-label="$t('player__play_toggle_mode_off')" @click="toggleMode('none')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 32 32" space="preserve">
            <use xlink:href="#icon-single" />
          </svg>
        </button>
      </div>
    </template>
  </material-popup-btn>
</template>

<script setup>
import { ref } from '@common/utils/vueTools'
// import useNextTogglePlay from '@renderer/utils/compositions/useNextTogglePlay'
// import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
// import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { appSetting } from '@renderer/store/setting'
import useNextTogglePlay from '@renderer/utils/compositions/useNextTogglePlay'

const btn_ref = ref(null)

const {
  nextTogglePlayName,
  toggleNextPlayMode,
} = useNextTogglePlay()

const toggleMode = (mode) => {
  btn_ref.value.hide()
  toggleNextPlayMode(mode)
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
  flex-flow: row nowrap;
  font-size: 14px;
  gap: 10px;
}


</style>
