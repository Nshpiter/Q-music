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
    <layout-play-queue />
  </div>
</template>

<script setup>
import { onMounted, watch } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { isUrl, encodePath } from '@common/utils/common'
import { isShowPlayerDetail } from '@renderer/store/player/state'
// import BubbleCursor from '@common/utils/effects/cursor-effects/bubbleCursor'
// import '@common/utils/effects/snow.min'
import useApp from '@renderer/core/useApp'
import WindowControlBtns from './components/layout/WindowControlBtns.vue'

useApp()

// 把「毛玻璃强度 / 模糊 / 自定义背景图」设置实时映射到 CSS 变量
const buildUserBgUrl = (bg) => {
  if (!bg) return ''
  return isUrl(bg) ? `url("${bg}")` : `url("file:///${encodePath(String(bg).replaceAll('\\', '/'))}")`
}
const applyGlassSetting = () => {
  const el = document.documentElement
  const opacity = appSetting['theme.glassOpacity']
  const blur = appSetting['theme.glassBlur']
  el.style.setProperty('--q-glass-opacity', String((typeof opacity == 'number' ? opacity : 22) / 100))
  el.style.setProperty('--q-glass-blur', `${typeof blur == 'number' ? blur : 20}px`)
  const bgUrl = buildUserBgUrl(appSetting['theme.customBgImage'])
  if (bgUrl) el.style.setProperty('--q-user-bg-image', bgUrl)
  else el.style.removeProperty('--q-user-bg-image')
}
watch(() => [appSetting['theme.glassOpacity'], appSetting['theme.glassBlur'], appSetting['theme.customBgImage']], applyGlassSetting)

onMounted(() => {
  applyGlassSetting()
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
  // 用户自定义背景图优先，未设置时回退到主题自带背景
  background: var(--q-user-bg-image, var(--background-image)) var(--background-image-position) no-repeat;
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
  border: 1px solid rgba(40, 50, 66, .14);
  background:
    radial-gradient(circle at 16% 6%, var(--color-primary-alpha-800), transparent 32%),
    linear-gradient(150deg, rgba(255, 255, 255, .08), rgba(255, 255, 255, .02) 44%, var(--color-primary-alpha-900)),
    var(--color-app-background);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .5),
    inset -18px 0 28px rgba(40, 50, 66, .03);
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
  // 液态玻璃：面板透明度与模糊由设置里的滑块控制（--q-glass-opacity / --q-glass-blur）。
  // 用相对颜色 rgb(from …) 取主题面板底色的 RGB、只替换透明度，浅色/深色主题都通用。
  background: var(--color-main-background); // 不支持相对颜色时的回退
  background:
    radial-gradient(circle at 14% 4%, var(--color-primary-alpha-900), transparent 30%),
    rgb(from var(--color-main-background) r g b / var(--q-glass-opacity, .22));

  border-radius: @radius-border;
  border: 1px solid rgba(40, 50, 66, .12);
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .55),
    inset 0 0 0 1px rgba(255, 255, 255, .24),
    0 18px 44px rgba(24, 34, 45, 0.16);
  backdrop-filter: blur(var(--q-glass-blur, 20px)) saturate(1.9);
  box-sizing: border-box;

  &:before {
    content: '';
    position: absolute;
    inset: 64px 0 @height-player 0;
    z-index: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, .16), rgba(255, 255, 255, .04) 40%, rgba(255, 255, 255, .12)),
      radial-gradient(circle at 56% 30%, var(--color-primary-alpha-900), transparent 34%);
  }

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    border-radius: inherit;
    box-shadow:
      inset 0 0 0 1px rgba(40, 50, 66, .08),
      inset 0 -1px 0 rgba(40, 50, 66, .06);
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
    // 播放栏比内容面板略实一点，保证控件清晰（在滑块透明度基础上 +0.18）
    background: var(--color-main-background);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, .12) 42%, rgba(255, 255, 255, .18)),
      rgb(from var(--color-main-background) r g b / calc(var(--q-glass-opacity, .22) + .18));
    border-top: 1px solid rgba(40, 50, 66, .1);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, .7),
      inset 0 -1px 0 rgba(40, 50, 66, .08);
    backdrop-filter: blur(calc(var(--q-glass-blur, 20px) + 8px)) saturate(1.7);
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

