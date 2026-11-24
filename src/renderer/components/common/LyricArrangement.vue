<template>
  <div :class="$style.controls" role="group" :aria-label="$t('lyric_arrangement')">
    <div :class="$style.choices">
      <button v-for="fan in [false, true]" :key="String(fan)" type="button" :aria-pressed="appSetting['playDetail.fanLyrics'] === fan" @click="updateSetting({ 'playDetail.fanLyrics': fan })">{{ $t(fan ? 'lyric_fan' : 'lyric_straight') }}</button>
    </div>
    <label v-if="appSetting['playDetail.fanLyrics']" :class="$style.curve">
      <span>{{ $t('lyric_curvature') }}</span>
      <input type="range" min="10" max="80" step="1" :aria-label="$t('lyric_curvature')" :style="{ '--fill': (appSetting['playDetail.fanCurvature'] - 10) / 70 * 100 + '%' }" :value="appSetting['playDetail.fanCurvature']" @input="updateSetting({ 'playDetail.fanCurvature': $event.target.valueAsNumber })">
      <span>{{ appSetting['playDetail.fanCurvature'] }}</span>
    </label>
  </div>
</template>

<script setup>
import { appSetting, updateSetting } from '@renderer/store/setting'
</script>

<style lang="less" module>
.controls { display: grid; gap: 10px; max-width: 300px; }
.choices {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 3px; padding: 3px;
  border-radius: 10px; background: rgb(from currentColor r g b / .07);
  button { appearance: none; min-height: 27px; padding: 3px 12px; border: 0; border-radius: 7px; font: inherit; font-size: 12px; color: inherit; cursor: pointer; background: transparent; }
  button:hover { background: rgb(from currentColor r g b / .06); }
  button[aria-pressed="true"] { background: rgb(from currentColor r g b / .12); font-weight: 650; }
  button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
}
.curve {
  display: flex; align-items: center; gap: 10px; font-size: 12px;
  input { appearance: none; flex: 1; height: 20px; min-width: 0; margin: 0; color: inherit; background: transparent; cursor: pointer; }
  input::-webkit-slider-runnable-track { height: 4px; border-radius: 4px; background: linear-gradient(to right, var(--color-primary) var(--fill), rgb(from currentColor r g b / .19) var(--fill)); }
  input::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; margin-top: -4px; border-radius: 50%; background: var(--color-primary); }
  input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; border-radius: 4px; }
  span:last-child { min-width: 2ch; text-align: right; font-variant-numeric: tabular-nums; }
}
</style>
