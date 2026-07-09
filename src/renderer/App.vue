<template>
  <div id="container" :class="['view-container', { 'control-btn-right': appSetting['common.controlBtnPosition'] == 'right' }]">
    <div id="window-drag-bar" aria-hidden="true" />
    <WindowControlBtns
      v-if="appSetting['common.controlBtnPosition'] == 'right'"
      id="window-control-btns"
      :detail-action="isShowPlayerDetail ? 'hide' : 'show'"
      fullscreen-exit-enabled
    />
    <layout-aside id="left" />
    <div id="right">
      <layout-toolbar id="toolbar" />
      <layout-view id="view" />
    </div>
    <div id="player">
      <layout-play-bar />
    </div>
    <layout-icons />
    <layout-change-log-modal />
    <layout-update-modal />
    <layout-pact-modal />
    <layout-sync-mode-modal />
    <layout-sync-auth-code-modal />
    <layout-play-detail />
  </div>
</template>

<script setup>
import { onMounted } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { isShowPlayerDetail } from '@renderer/store/player/state'
// import BubbleCursor from '@common/utils/effects/cursor-effects/bubbleCursor'
// import '@common/utils/effects/snow.min'
import useApp from '@renderer/core/useApp'
import WindowControlBtns from './components/layout/WindowControlBtns.vue'

useApp()

onMounted(() => {
  document.getElementById('root').style.display = 'block'

  // const styles = getComputedStyle(document.documentElement)
  // window.lxData.bubbleCursor = new BubbleCursor({
  //   fillStyle: styles.getPropertyValue('--color-primary-alpha-900'),
  //   strokeStyle: styles.getPropertyValue('--color-primary-alpha-700'),
  // })
})

// onBeforeUnmount(() => {
//   window.lxData.bubbleCursor?.destroy()
// })

</script>


<style lang="less">
@import './assets/styles/index.less';
@import './assets/styles/layout.less';

@window-control-width: 184px;

html {
  height: 100vh;
}
html, body {
  // overflow: hidden;
  box-sizing: border-box;
}

body {
  user-select: none;
  height: 100%;
}
#root {
  height: 100%;
  position: relative;
  overflow: hidden;
  color: var(--color-font);
  background: var(--background-image) var(--background-image-position) no-repeat;
  background-size: var(--background-image-size);
  transition: background-color @transition-normal;
  background-color: var(--color-content-background);
  box-sizing: border-box;
}

.disableAnimation * {
  transition: none !important;
  animation: none !important;
}

.transparent {
  background: transparent;
  padding: 0;
  // #waiting-mask {
  //   border-radius: @radius-border;
  //   left: @shadow-app;
  //   right: @shadow-app;
  //   top: @shadow-app;
  //   bottom: @shadow-app;
  // }
  #body {
    border-radius: 12px;
  }
  #root {
    box-shadow: inset 0 0 0 1px rgba(62, 88, 76, .2);
    border-radius: 12px;
  }
  #container {
    border-radius: 12px;
    border-color: rgba(62, 88, 76, .28);
  }
}
.disableTransparent {
  background-color: var(--color-content-background);

  #body {
    border: 1Px solid var(--color-primary-light-500);
  }

  #right {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  // #view { // 偏移5px距离解决非透明模式下右侧滚动条无法拖动的问题
  //   margin-right: 5Px;
  // }
}
.fullscreen {
  background-color: var(--color-content-background);

  #right {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
}

#window-drag-bar {
  display: none;
}

#container {
  position: relative;
  display: flex;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid rgba(62, 88, 76, .2);
  background:
    radial-gradient(circle at 18% 8%, var(--color-primary-alpha-800), transparent 30%),
    linear-gradient(135deg, var(--color-primary-light-1000-alpha-100), var(--color-primary-light-900-alpha-200) 42%, var(--color-primary-alpha-900)),
    var(--color-app-background);
  box-shadow:
    inset -1px 0 0 rgba(62, 88, 76, .16),
    inset 0 1px 0 rgba(255, 255, 255, .52),
    inset -18px 0 28px rgba(62, 88, 76, .045),
    inset 0 14px 28px rgba(255, 255, 255, .28);
}

.transparent,
.disableTransparent {
  #window-drag-bar {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 34px;
    z-index: 8;
    display: block;
    -webkit-app-region: drag;
  }

  .control-btn-right {
    #window-drag-bar {
      display: none;
    }
  }
}

.fullscreen {
  #window-drag-bar {
    display: none;
  }
}

#left {
  position: relative;
  z-index: 9;
  flex: none;
  width: @width-app-left;
  min-width: @width-app-left;
}
#right {
  position: relative;
  z-index: 9;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
  transition: background-color @transition-normal;
  min-width: 0;
  margin: 0 0 14px 0;
  background:
    radial-gradient(circle at 18% 8%, rgba(75, 174, 126, .08), transparent 28%),
    radial-gradient(circle at 96% 4%, rgba(103, 142, 128, .08), transparent 24%),
    linear-gradient(180deg, rgba(246, 252, 249, .78), rgba(255, 255, 255, .68) 42%, rgba(248, 253, 250, .82)),
    var(--color-main-background);

  border-radius: @radius-border;
  border: 1px solid rgba(54, 83, 70, .24);
  overflow: hidden;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, .62),
    inset -1px 0 0 rgba(54, 83, 70, .1),
    inset 0 1px 0 rgba(54, 83, 70, .08),
    inset -16px 0 22px rgba(54, 83, 70, .035),
    inset 0 12px 20px rgba(255, 255, 255, .42),
    0 14px 38px rgba(31, 45, 39, 0.13);
  backdrop-filter: blur(18px);
  box-sizing: border-box;

  &:before {
    content: '';
    position: absolute;
    inset: 64px 0 @height-player 0;
    z-index: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(235, 248, 242, .32), rgba(255, 255, 255, .14) 34%, rgba(233, 246, 240, .2)),
      radial-gradient(circle at 56% 34%, rgba(75, 174, 126, .055), transparent 30%);
  }

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    border-radius: inherit;
    box-shadow:
      inset 0 0 0 1px rgba(54, 83, 70, .1),
      inset 0 -1px 0 rgba(54, 83, 70, .08);
  }
}
#window-control-btns {
  position: absolute;
  top: 0;
  right: 0;
  width: @window-control-width;
  height: 44px;
  z-index: 1000;
  pointer-events: auto;
  -webkit-app-region: no-drag !important;

  * {
    -webkit-app-region: no-drag !important;
  }
}
#toolbar {
  flex: none;
}
#player {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: @height-player;
  z-index: 12;
  pointer-events: none;
  overflow: visible;

  &:before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 76px;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(238, 249, 244, .66) 40%, rgba(222, 241, 232, .78)),
      linear-gradient(90deg, rgba(70, 116, 94, .08), rgba(255, 255, 255, .54) 22%, rgba(255, 255, 255, .5) 78%, rgba(70, 116, 94, .12));
    border-top: 1px solid rgba(54, 83, 70, .1);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, .72),
      inset 0 -1px 0 rgba(54, 83, 70, .12);
    backdrop-filter: blur(18px) saturate(1.12);
  }

  > * {
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }
}
#view {
  position: relative;
  flex: auto;
  // display: flex;
  min-height: 0;
  z-index: 1;
}
#view.show-modal {
  z-index: 20;
}

.view-container {
  transition: opacity @transition-normal;
}
#root.show-modal > .view-container {
  opacity: .9;
}
#view.show-modal > .view-container {
  opacity: .2;
}

</style>

