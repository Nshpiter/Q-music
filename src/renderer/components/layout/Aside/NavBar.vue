<template>
  <div ref="dom_menu" :class="$style.menu">
    <ul :class="$style.list" role="toolbar">
      <li v-for="item in menus" :key="item.to" :class="$style.navItem" role="presentation">
        <router-link :class="[$style.link, {[$style.active]: $route.meta.name == item.name}]" role="tab" :aria-selected="$route.meta.name == item.name" :to="item.to" :aria-label="item.tips">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" :viewBox="item.iconSize" :height="item.size" :width="item.size" space="preserve">
            <use :xlink:href="item.icon" />
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
import { ref, computed } from '@common/utils/vueTools'
import { useIconSize } from '@renderer/utils/compositions/useIconSize'

export default {
  name: 'NavBar',
  setup() {
    const t = useI18n()
    const dom_menu = ref<HTMLElement>()
    const iconSize = useIconSize(dom_menu, 0.32)

    const menus = computed(() => {
      const size = iconSize.value
      return [
        {
          to: '/search',
          tips: t('search'),
          icon: '#icon-search-2',
          iconSize: '0 0 425.2 425.2',
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
    return {
      appSetting,
      menus,
      dom_menu,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.menu {
  flex: auto;
  // &.controlBtnLeft {
  //   display: flex;
  //   flex-flow: column nowrap;
  //   justify-content: center;
  //   padding-bottom: @control-btn-height;
  // }
  // padding: 5px;
}
.list {
  -webkit-app-region: no-drag;
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
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
}
.link {
  position: relative;
  left: auto;
  top: auto;
  width: 100%;
  height: 46px;
  // left: 15%;
  // top: 15%;
  // width: 70%;
  // height: 70%;
  // display: block;
  box-sizing: border-box;
  // text-decoration: none;
  // border-radius: 20%;

  // padding: 18px 3px;
  // margin: 5px 0;
  // border-left: 5px solid transparent;
  padding: 0 12px;
  gap: 12px;
  border-radius: @radius-border;
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
    width: 18px;
    height: 18px;
    padding: 6px;
    border-radius: 11px;
    color: var(--color-nav-font);
    background: rgba(255, 255, 255, .4);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .55);
    transition: @transition-fast;
    transition-property: background, color, box-shadow, transform;
  }

  span {
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    .mixin-ellipsis-1();
  }

  // 选中态：主色实心图标胶囊 + 柔和玻璃底，取代原来的左侧竖线
  &.active {
    color: var(--color-primary-dark-300);
    background-color: var(--color-primary-alpha-900);
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-800);

    svg {
      color: #fff;
      background: linear-gradient(145deg, var(--color-primary-light-100), var(--color-primary));
      box-shadow: 0 6px 14px var(--color-primary-alpha-700), inset 0 1px 0 rgba(255, 255, 255, .4);
    }

    &:hover {
      background-color: var(--color-primary-alpha-800);
    }
  }


  &:hover {
    color: var(--color-nav-font);

    &:not(.active) {
      opacity: 1;
      background-color: rgba(255, 255, 255, .42);
      transform: translateX(2px);
      svg {
        background: rgba(255, 255, 255, .62);
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

</style>
