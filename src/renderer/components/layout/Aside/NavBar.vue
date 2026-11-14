<template>
  <div ref="dom_menu" :class="$style.menu">
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
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" :viewBox="item.iconSize" :height="item.size" :width="item.size" space="preserve">
            <template v-if="item.name == 'History'">
              <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8" />
              <path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </template>
            <use v-else :xlink:href="item.icon" />
          </svg>
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
import { useIconSize } from '@renderer/utils/compositions/useIconSize'

export default {
  name: 'NavBar',
  setup() {
    const t = useI18n()
    const dom_menu = ref<HTMLElement>()
    const dom_list = ref<HTMLElement>()
    const iconSize = useIconSize(dom_menu, 0.32)

    const menus = computed(() => {
      const size = iconSize.value
      return [
        {
          to: '/search',
          tips: t('nav_home'),
          icon: '#icon-home',
          iconSize: '0 0 24 24',
          size,
          name: 'Search',
          enable: true,
        },
        {
          to: '/songList/list',
          tips: t('song_list'),
          icon: '#icon-album',
          iconSize: '0 0 425.2 425.2',
          size,
          name: 'SongList',
          enable: true,
        },
        {
          to: '/leaderboard',
          tips: t('leaderboard'),
          icon: '#icon-leaderboard',
          iconSize: '0 0 425.22 425.2',
          size,
          name: 'Leaderboard',
          enable: true,
        },
        {
          to: '/list',
          tips: t('my_list'),
          icon: '#icon-love',
          iconSize: '0 0 444.87 391.18',
          size,
          name: 'List',
          enable: true,
        },
        {
          to: '/history',
          tips: t('play_history_title'),
          icon: '',
          iconSize: '0 0 24 24',
          size,
          name: 'History',
          enable: true,
        },
        {
          to: '/download',
          tips: t('download'),
          icon: '#icon-download-2',
          iconSize: '0 0 425.2 425.2',
          size,
          enable: appSetting['download.enable'],
          name: 'Download',
        },
        {
          to: '/setting',
          tips: t('setting'),
          icon: '#icon-setting',
          iconSize: '0 0 493.23 436.47',
          size,
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
      dom_menu,
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
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
  -webkit-app-region: no-drag;
  // &.controlBtnLeft {
  //   display: flex;
  //   flex-flow: column nowrap;
  //   justify-content: center;
  //   padding-bottom: @control-btn-height;
  // }
  // padding: 5px;
}
.list {
  position: relative;
  -webkit-app-region: no-drag;
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
  // 为悬停时的右移动效留出空间，避免撑出横向滚动条。
  margin-right: 2px;
  // margin-bottom: 15px;
  &:last-child {
    margin-bottom: 0;
  }
  // background-color: pink;
  // dt {
  //   padding-left: 5px;
  //   font-size: 11px;
  //   transition: @transition-normal;
  //   transition-property: color;
  //   color: @color-theme-font-label;
  //   .mixin-ellipsis-1();
  // }
}
.navItem {
  position: relative;
  flex: none;
}
// 选中底块独立于导航项，位置和高度跟随实际菜单项。
.indicator {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  border-radius: 14px;
  pointer-events: none;
  // 跟随文字色，深色主题下选中底块同样可见。
  background: rgb(from var(--color-font) r g b / .1);
  box-shadow: inset 0 0 0 1px rgb(from var(--color-font) r g b / .16), 0 8px 20px rgba(35, 38, 36, .07);
}
.indicatorReady {
  transition: transform .42s cubic-bezier(.22, 1, .36, 1);
}
.link {
  position: relative;
  left: auto;
  top: auto;
  width: 100%;
  height: 50px;
  // left: 15%;
  // top: 15%;
  // width: 70%;
  // height: 70%;
  // display: block;
  box-sizing: border-box;
  text-decoration: none;
  // text-decoration: none;
  // border-radius: 20%;

  // padding: 18px 3px;
  // margin: 5px 0;
  // border-left: 5px solid transparent;
  padding: 0 13px;
  gap: 13px;
  border-radius: 14px;
  transition: @transition-fast;
  transition-property: background-color, color, opacity, box-shadow, transform;
  color: var(--color-nav-font);
  cursor: pointer;
  // font-size: 11.5px;
  text-align: center;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: flex-start;

  // border-radius: @radius-border;
  .mixin-ellipsis-1();

  svg {
    flex: none;
    width: 20px;
    height: 20px;
    padding: 7px;
    border-radius: 12px;
    color: var(--color-nav-font);
    background: var(--q-surface-soft);
    box-shadow: inset 0 0 0 1px var(--q-border);
    transition: @transition-fast;
    transition-property: background, color, box-shadow, transform;
  }

  span {
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    .mixin-ellipsis-1();
  }

  // 选中态：主色实心图标胶囊 + 柔和玻璃底，取代原来的左侧竖线
  &.active {
    color: var(--color-font);
    background: transparent;

    svg {
      color: var(--color-content-background);
      background: linear-gradient(145deg, rgb(from var(--color-font) r g b / .78), var(--color-font));
      box-shadow: 0 7px 16px rgba(22, 24, 23, .24), inset 0 1px 0 var(--q-border);
    }

    &:hover {
      background: rgb(from var(--color-font) r g b / .04);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }


  &:hover {
    color: var(--color-nav-font);

    &:not(.active) {
      opacity: 1;
      background-color: var(--q-surface);
      transform: translateX(2px);
      svg {
        background: var(--q-surface);
      }
    }
  }
  &:active:not(.active) {
    opacity: .72;
    background-color: var(--color-primary-light-600-alpha-400);
  }
}

// .icon {
//   // margin-bottom: 5px;
//   &> svg {
//     width: 32%;
//   }
// }

// 小窗口收紧导航间距，并为底部播放栏留出空间。
@media (max-height: 620px) {
  .list { gap: 4px; }
  .link { height: 44px; }
  .link svg { width: 18px; height: 18px; padding: 6px; }
}

</style>
