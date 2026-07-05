<template>
  <div :class="[$style.aside, { [$style.fullscreen]: isFullscreen }]">
    <ControlBtns v-if="appSetting['common.controlBtnPosition'] == 'left'" />
    <div v-else :class="$style.logo">
      <span :class="$style.logoMark">Q</span>
      <span :class="$style.logoText">music</span>
    </div>
    <NavBar />
  </div>
</template>

<script setup>
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
  -webkit-app-region: no-drag;
  -webkit-user-select: none;
  display: flex;
  flex-flow: column nowrap;
  gap: 18px;
  padding: 22px 14px;
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
  height: 42px;
  color: var(--color-nav-font);
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: drag;
}

.logoMark {
  width: 36px;
  height: 36px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: @radius-border;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark-300));
  box-shadow: 0 10px 22px var(--color-primary-alpha-800);
}

.logoText {
  min-width: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--color-font);
  .mixin-ellipsis-1();
}

</style>
