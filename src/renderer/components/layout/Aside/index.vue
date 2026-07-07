<template>
  <div :class="[$style.aside, { [$style.fullscreen]: isFullscreen }]">
    <ControlBtns v-if="appSetting['common.controlBtnPosition'] == 'left'" />
    <div v-else :class="$style.logo">
      <img :class="$style.logoIcon" :src="appIcon" width="36" height="36" alt="" draggable="false">
      <span :class="$style.logoText">Q-music</span>
    </div>
    <NavBar />
  </div>
</template>

<script setup>
import appIcon from '@renderer/assets/images/app-icon.png'
import { isFullscreen } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'

import ControlBtns from './ControlBtns.vue'
import NavBar from './NavBar.vue'

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.aside {
  // box-shadow: 0 0 5px rgba(0, 0, 0, .3);
  transition: @transition-normal;
  transition-property: background-color;
  // background-color: @color-theme-sidebar;
  // background-color: @color-aside-background;
  // border-right: 2px solid var(--color-primary);
  -webkit-app-region: drag;
  -webkit-user-select: none;
  display: flex;
  flex-flow: column nowrap;
  gap: 16px;
  padding: 24px 18px 22px 20px;
  box-sizing: border-box;

  &.fullscreen {
    -webkit-app-region: no-drag;
    .logo {
      display: none;
    }
  }
}

.logo {
  box-sizing: border-box;
  height: 44px;
  color: var(--color-nav-font);
  flex: none;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 4px;
  -webkit-app-region: drag;
}

.logoIcon {
  width: 36px;
  height: 36px;
  flex: none;
  object-fit: contain;
  filter: drop-shadow(0 6px 12px rgba(64, 66, 66, .12));
}

.logoText {
  min-width: 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: 0;
  color: var(--color-font);
  .mixin-ellipsis-1();
}

</style>
