<template>
  <div id="container" class="view-container">
    <div id="window-drag-bar" aria-hidden="true" />
    <layout-aside id="left" />
    <div id="right">
      <layout-toolbar id="toolbar" />
      <layout-view id="view" />
    </div>
    <layout-play-bar id="player" />
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
// import BubbleCursor from '@common/utils/effects/cursor-effects/bubbleCursor'
// import '@common/utils/effects/snow.min'
import useApp from '@renderer/core/useApp'

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
    border-color: rgba(62, 88, 76, .24);
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
  border: 1px solid transparent;
  background:
    radial-gradient(circle at 18% 8%, var(--color-primary-alpha-800), transparent 30%),
    linear-gradient(135deg, var(--color-primary-light-1000-alpha-100), var(--color-primary-light-900-alpha-200) 42%, var(--color-primary-alpha-900)),
    var(--color-app-background);
}

.transparent,
.disableTransparent {
  #window-drag-bar {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 34px;
    z-index: 20;
    display: block;
    -webkit-app-region: drag;
  }
}

.fullscreen {
  #window-drag-bar {
    display: none;
  }
}

#left {
  flex: none;
  width: @width-app-left;
  min-width: @width-app-left;
}
#right {
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
  transition: background-color @transition-normal;
  min-width: 0;
  margin: 14px 14px 14px 0;
  background-color: var(--color-main-background);

  border-radius: @radius-border;
  border: 1px solid rgba(70, 96, 84, .16);
  overflow: hidden;
  box-shadow: 0 14px 38px rgba(31, 45, 39, 0.13);
  backdrop-filter: blur(18px);
  box-sizing: border-box;
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
}
#view {
  position: relative;
  flex: auto;
  // display: flex;
  min-height: 0;
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

