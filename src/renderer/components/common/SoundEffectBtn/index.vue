<template>
  <button :class="$style.btn" :aria-label="$t('player__sound_effect')" @click="visible = true">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h8" />
      <path d="M17 7h2" />
      <path d="M15 5v4" />
      <path d="M5 12h2" />
      <path d="M11 12h8" />
      <path d="M9 10v4" />
      <path d="M5 17h10" />
      <path d="M19 17h0" />
      <path d="M17 15v4" />
    </svg>
  </button>
  <material-modal :show="visible" bg-close="bg-close" :teleport="teleport" @close="visible = false">
    <!-- <main :class="$style.main"> -->
    <!-- <h2 :class="$style.title">{{ $t('theme_edit_modal__title') }}</h2> -->
    <div :class="$style.content">
      <div :class="['scroll', $style.row]">
        <AudioConvolution />
        <PitchShifter />
        <AudioPanner />
      </div>
      <div :class="['scroll', $style.row]">
        <BiquadFilter />
      </div>
    </div>
    <p v-if="showTip" :class="$style.tip">{{ $t('player__sound_effect_features_tip') }}</p>
    <!-- </main> -->
  </material-modal>
</template>

<script setup>
import { ref, watch } from '@common/utils/vueTools'
// import useNextTogglePlay from '@renderer/utils/compositions/useNextTogglePlay'
// import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
// import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
// import { saveVolumeIsMute } from '@renderer/store/setting'
// import { volume, isMute } from '@renderer/store/player/volume'
// import fs from 'node:fs'
import BiquadFilter from './BiquadFilter.vue'
import AudioPanner from './AudioPanner.vue'
import AudioConvolution from './AudioConvolution.vue'
import PitchShifter from './PitchShifter.vue'
import { appSetting } from '@renderer/store/setting'

defineProps({
  teleport: {
    type: String,
    default: '#root',
  },
})

const visible = ref(false)

const showTip = ref(false)

watch(visible, (visible) => {
  if (visible) showTip.value = appSetting['player.mediaDeviceId'] != 'default'
})


</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
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
    filter: none;
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
}

.main {
  min-width: 300px;
  // max-height: 100%;
  // overflow: hidden;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  min-height: 0;
}
// .title {
//   flex: none;
//   font-size: 16px;
//   color: var(--color-font);
//   line-height: 1.3;
//   text-align: center;
//   padding: 10px;
// }
.content {
  display: flex;
  flex-flow: row nowrap;
  padding: 0 5px;
  margin: 15px 0;
  gap: 10px;
  position: relative;
  min-height: 0;

  &:before {
    .mixin-after();
    position: absolute;
    left: 50%;
    height: 100%;
    border-left: 1px dashed var(--color-primary-light-100-alpha-700);
  }
  // width: 400px;

  :global {
    // .player__sound_effect_contnet {
    //   display: flex;
    // }
    .player__sound_effect_title {
      // margin-bottom: 10px;
      font-size: 14px;
      padding-bottom: 8px;
    }
  }
}

.row {
  width: 50%;
  display: flex;
  gap: 15px;
  flex-flow: column nowrap;
  padding: 0 10px;
}

.tip {
  padding: 0 15px 15px;
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.25;
  color: var(--color-font);
}

</style>
