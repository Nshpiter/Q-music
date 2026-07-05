<template>
  <div :class="$style.controlBtn">
    <!-- <common-volume-bar /> -->
    <button :class="$style.titleBtn" :aria-label="$t('player__add_music_to')" @click="addMusicTo">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20s-7-4.2-7-9a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 4.8-7 9-7 9z" />
        <path d="M18 17v4" />
        <path d="M16 19h4" />
      </svg>
    </button>
    <button :class="$style.titleBtn" :aria-label="toggleDesktopLyricBtnTitle" @click="toggleDesktopLyric" @contextmenu="toggleLockDesktopLyric">
      <svg v-show="appSetting['desktopLyric.enable']" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14" />
        <path d="M5 11h9" />
        <path d="M5 16h6" />
        <path d="M16 15.5c1.9 0 3 1 3 2.3s-1.1 2.2-3 2.2-3-1-3-2.2 1.1-2.3 3-2.3z" />
        <path d="M19 8v9.6" />
      </svg>
      <svg v-show="!appSetting['desktopLyric.enable']" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14" />
        <path d="M5 11h9" />
        <path d="M5 16h6" />
        <path d="M16 15.5c1.9 0 3 1 3 2.3s-1.1 2.2-3 2.2-3-1-3-2.2 1.1-2.3 3-2.3z" />
        <path d="M19 8v9.6" />
        <path d="M4 20L20 4" />
      </svg>
    </button>
    <common-volume-btn />
    <common-toggle-play-mode-btn />
    <common-list-add-modal v-model:show="isShowAddMusicTo" :music-info="playMusicInfo.musicInfo" />
  </div>
</template>

<script>
import { ref } from '@common/utils/vueTools'
import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { appSetting } from '@renderer/store/setting'

export default {
  setup() {
    const isShowAddMusicTo = ref(false)
    const {
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
    } = useToggleDesktopLyric()
    const addMusicTo = () => {
      if (!musicInfo.id) return
      isShowAddMusicTo.value = true
    }
    return {
      appSetting,
      isShowAddMusicTo,
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
      addMusicTo,
      playMusicInfo,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.controlBtn {
  padding-left: 0;
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  justify-content: flex-end;
  gap: clamp(7px, .8vw, 12px);
  height: 40px;
  align-items: center;

  button {
    width: 36px;
    height: 36px;
    color: rgba(29, 34, 38, .7);
    border-radius: 50%;
    opacity: .82;
    transition: opacity @transition-normal, color @transition-fast, background-color @transition-fast, transform @transition-fast;

    &:hover {
      opacity: 1;
      color: rgba(29, 34, 38, .9);
      background-color: rgba(29, 34, 38, .06) !important;
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
      filter: none;
      opacity: 1;
    }
  }

  :global {
    .material-popup-btn,
    .popup-btn {
      height: 40px;
    }
  }
}

.titleBtn {
  flex: none;
  height: 36px;
  width: 36px;
  transition: @transition-fast;
  transition-property: color, opacity, background-color;
  // color: var(--color-button-font);
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  border: none;
  padding: 0;
  border-radius: 50%;

  opacity: .72;
  cursor: pointer;

  svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: none;
  }
  &:hover {
    opacity: 1;
    background-color: rgba(29, 34, 38, .06);
  }
  &:active {
    opacity: 1;
  }
}


</style>
