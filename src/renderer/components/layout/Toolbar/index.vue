<template>
  <div :class="[$style.toolbar, { [$style.fullscreen]: isFullscreen }, appSetting['common.controlBtnPosition'] == 'left' ? $style.controlBtnLeft : $style.controlBtnRight]">
    <div :class="$style.dragArea" aria-hidden="true" />
    <router-link v-if="lastSearch && route.fullPath != lastSearch" :to="lastSearch" :class="$style.resumeSearch" :aria-label="$t('search__resume')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
      <span>{{ $t('search__resume') }}</span>
    </router-link>
    <SearchInput />
    <div v-if="appSetting['common.controlBtnPosition'] == 'left'" :class="$style.logo">Q-music</div>
  </div>
</template>

<script setup>
import { isFullscreen } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import SearchInput from './SearchInput.vue'
import { ref, watch } from '@common/utils/vueTools'
import { useRoute } from '@common/utils/vueRouter'

const route = useRoute()
const lastSearch = ref('')
watch(() => route.fullPath, () => {
  if (route.path == '/search' && typeof route.query.text == 'string' && route.query.text.trim()) lastSearch.value = route.fullPath
}, { immediate: true })

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@window-control-width: 184px;

.toolbar {
  position: relative;
  display: flex;
  height: @height-toolbar;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 calc(@window-control-width + 18px) 0 18px;
  -webkit-app-region: no-drag;
  z-index: 2;
  background:
    linear-gradient(180deg, var(--q-surface-strong), var(--q-surface)),
    var(--q-surface-soft);
  border-bottom: 1px solid rgba(54, 83, 70, .16);
  box-shadow:
    inset 0 1px 0 var(--q-border),
    inset 0 -1px 0 rgba(54, 83, 70, .055),
    0 1px 0 var(--q-border),
    0 12px 28px rgba(54, 83, 70, .055);
  backdrop-filter: blur(var(--q-glass-blur, 20px)) saturate(1.18);

  .dragArea {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: 0;
    -webkit-app-region: drag;
  }

  // 搜索展开时，空白区先接收点击来收起面板；失焦后恢复原生窗口拖动。
  &:has(input:focus) .dragArea,
  &:has([aria-expanded='true']) .dragArea {
    -webkit-app-region: no-drag;
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
    .dragArea {
      right: @window-control-width;
    }
  }

  &.controlBtnLeft {
    padding-right: 18px;
    padding-left: calc(@window-control-width + 18px);
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

.resumeSearch {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
  padding: 8px 6px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--color-font);
  font-size: 12px;
  svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; }
  &:hover { background: var(--color-primary-alpha-800); }
  &:focus-visible { outline: 2px solid var(--color-primary); }
}
@media (max-width: 1000px) {
  .resumeSearch span { display: none; }
}

</style>
