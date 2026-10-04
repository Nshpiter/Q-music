<template>
  <div :class="$style.view">
    <router-view v-slot="{ Component, route }">
      <transition name="q-route">
        <component :is="Component" :key="route.name == 'Search' ? route.path : route.fullPath" class="view-container" />
      </transition>
    </router-view>
  </div>
</template>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.view {
  position: relative;
  z-index: 1;
  > :global(.view-container) {
    position: absolute !important;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
  }
  // background: #fff;
  // overflow: hidden;
}

// 页面绝对定位叠放，新旧页面交叉淡入；离场页面不再响应点击，避免快速切换时误触。
:global(.view-container.q-route-enter-active) {
  transition: opacity .26s ease, transform .32s cubic-bezier(.22, 1, .36, 1);
}
:global(.view-container.q-route-leave-active) {
  transition: opacity .16s ease;
  pointer-events: none;
}
:global(.view-container.q-route-enter-from) {
  opacity: 0;
  transform: translateY(8px);
}
:global(.view-container.q-route-leave-to) {
  opacity: 0;
}

</style>
