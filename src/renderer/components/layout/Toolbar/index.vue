<template>
  <div :class="[$style.toolbar, { [$style.fullscreen]: isFullscreen }, appSetting['common.controlBtnPosition'] == 'left' ? $style.controlBtnLeft : $style.controlBtnRight]">
    <div :class="$style.dragArea" aria-hidden="true" />
    <SearchInput />
    <div v-if="appSetting['common.controlBtnPosition'] == 'left'" :class="$style.logo">Q-music</div>
  </div>
</template>

<script setup>
import { isFullscreen } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import SearchInput from './SearchInput.vue'

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@window-control-width: 184px;

.toolbar {
  position: relative;
  display: flex;
  height: @height-toolbar;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  -webkit-app-region: no-drag;
  z-index: 2;
  background:
    linear-gradient(180deg, rgba(248, 253, 250, .82), rgba(236, 249, 243, .54)),
    rgba(255, 255, 255, .34);
  border-bottom: 1px solid rgba(54, 83, 70, .16);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .74),
    inset 0 -1px 0 rgba(54, 83, 70, .055),
    0 1px 0 rgba(255, 255, 255, .62),
    0 12px 28px rgba(54, 83, 70, .055);
  backdrop-filter: blur(20px) saturate(1.18);

  .dragArea {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 0;
    -webkit-app-region: drag;
  }

  > * {
    position: relative;
    z-index: 1;
    -webkit-app-region: no-drag;
  }

  &.fullscreen {
    -webkit-app-region: no-drag;
    .logo {
      display: none;
    }
  }

  &.controlBtnLeft {
    .control {
      display: none;
    }
  }
  &.controlBtnRight {
    justify-content: space-between;

    .dragArea {
      right: @window-control-width;
    }
  }
}

.logo {
  box-sizing: border-box;
  padding: 0 @height-toolbar * .4;
  height: @height-toolbar;
  color: var(--color-primary);
  flex: none;
  text-align: center;
  line-height: @height-toolbar;
  font-weight: bold;
  // -webkit-app-region: no-drag;
}

</style>
