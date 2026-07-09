<template lang="pug">
div(:class="$style.header")
</template>


<script setup>

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.header {
  position: relative;
  z-index: 6;
  flex: 0 0 @height-toolbar;
  -webkit-app-region: no-drag;
  width: 100%;
  align-self: flex-start;

  &:before {
    content: '';
    position: absolute;
    left: 0;
    right: 190px;
    top: 8px;
    height: calc(100% - 8px);
    -webkit-app-region: drag;
  }
}

:global(.fullscreen) {
  .header {
    -webkit-app-region: no-drag;
    align-self: flex-start;

    &:before {
      display: none;
    }
  }
}
</style>
