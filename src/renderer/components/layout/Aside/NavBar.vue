<template>
  <div :class="$style.menu">
    <ul ref="dom_list" :class="$style.list" role="toolbar">
      <li
        v-show="indicator.height > 0"
        :class="[$style.indicator, { [$style.indicatorReady]: indicatorReady }]"
        :style="{ transform: `translateY(${indicator.top}px)`, height: `${indicator.height}px` }"
        role="presentation"
        aria-hidden="true"
      />
      <li v-for="item in menus" :key="item.to" :class="$style.navItem" role="presentation">
        <router-link :class="[$style.link, {[$style.active]: $route.meta.name == item.name}]" role="tab" :aria-selected="$route.meta.name == item.name" :to="item.to" :aria-label="item.tips">
          <svg viewBox="0 0 24 24" aria-hidden="true"><use :href="item.icon" /></svg>
          <span>{{ item.tips }}</span>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { appSetting } from '@renderer/store/setting'
import { useI18n } from '@root/lang'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { useRoute } from '@common/utils/vueRouter'

export default {
  name: 'NavBar',
  setup() {
    const t = useI18n()
    const dom_list = ref<HTMLElement>()

    const menus = computed(() => {
      return [
        {
          to: '/search',
          tips: t('nav_home'),
          icon: '#icon-home',
          name: 'Search',
          enable: true,
        },
        {
          to: '/songList/list',
          tips: t('song_list'),
          icon: '#icon-album',
          name: 'SongList',
          enable: true,
        },
        {
          to: '/leaderboard',
          tips: t('leaderboard'),
          icon: '#icon-leaderboard',
          name: 'Leaderboard',
          enable: true,
        },
        {
          to: '/list',
          tips: t('my_list'),
          icon: '#icon-library',
          name: 'List',
          enable: true,
        },
        {
          to: '/history',
          tips: t('play_history_title'),
          icon: '#icon-history',
          name: 'History',
          enable: true,
        },
        {
          to: '/download',
          tips: t('download'),
          icon: '#icon-download-2',
          enable: appSetting['download.enable'],
          name: 'Download',
        },
        {
          to: '/setting',
          tips: t('setting'),
          icon: '#icon-setting',
          enable: true,
          name: 'Setting',
        },
      ].filter(m => m.enable)
    })
    const route = useRoute()
    const activeIndex = computed(() => menus.value.findIndex(m => m.name == route.meta.name))
    const indicator = reactive({ top: 0, height: 0 })

    // 样式会从 px 转为 rem；按实际布局定位，避免字号变化后逐项累积偏移。
    const updateIndicator = () => {
      const list = dom_list.value
      const target = list?.querySelector<HTMLElement>('a[aria-selected="true"]')
      if (!list || !target) { indicator.height = 0; return }
      const bounds = target.getBoundingClientRect()
      indicator.top = bounds.top - list.getBoundingClientRect().top
      indicator.height = bounds.height
    }
    watch([activeIndex, menus], updateIndicator, { flush: 'post' })

    // 首次定位不播放滑动动画，避免启动时选中块从顶部滑下来
    const indicatorReady = ref(false)
    let resizeObserver: ResizeObserver | undefined
    let readyFrame = 0
    onMounted(() => {
      updateIndicator()
      readyFrame = requestAnimationFrame(() => {
        indicatorReady.value = true
      })
      resizeObserver = new ResizeObserver(updateIndicator)
      if (dom_list.value) resizeObserver.observe(dom_list.value)
    })
    onBeforeUnmount(() => {
      resizeObserver?.disconnect()
      cancelAnimationFrame(readyFrame)
    })

    return {
      appSetting,
      menus,
      dom_list,
      indicator,
      indicatorReady,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.menu {
  flex: auto;
  min-height: 0;
  overflow: hidden auto;
  scrollbar-width: thin;
  -webkit-app-region: no-drag;
}
.list { position: relative; display: flex; flex-direction: column; gap: 4px; }
.navItem { position: relative; flex: none; }
.indicator {
  position: absolute;
  inset: 0 0 auto;
  pointer-events: none;
  border-radius: 12px;
  background: rgb(from var(--color-font) r g b / .075);
}
.indicatorReady { transition: transform .28s cubic-bezier(.2, .8, .2, 1); }
.link {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 14px;
  height: 46px;
  padding: 0 16px;
  border-radius: 12px;
  color: color-mix(in srgb, var(--color-font) 82%, transparent);
  text-decoration: none;
  transition: background-color @transition-fast, color @transition-fast;

  svg { flex: none; width: 21px; height: 21px; }
  span { min-width: 0; font-size: 14px; font-weight: 500; .mixin-ellipsis-1(); }
  &:hover:not(.active) { color: var(--color-font); background: rgb(from var(--color-font) r g b / .06); }
  &:active:not(.active) { background: rgb(from var(--color-font) r g b / .1); }
  &.active {
    color: var(--color-font);
    span { font-weight: 650; }
  }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
}
@media (max-height: 620px) {
  .list { gap: 2px; }
  .link { height: 40px; }
}
@media (prefers-reduced-motion: reduce) {
  .indicatorReady, .link { transition: none; }
}
</style>
