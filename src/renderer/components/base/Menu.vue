<template>
  <teleport to="#root">
    <ul ref="dom_menu" :class="$style.list" :style="menuStyles" role="toolbar" :aria-hidden="!modelValue">
      <li
        v-for="item in menus"
        v-show="!item.hide && (item.action == 'download' ? appSetting['download.enable'] : true)"
        :key="item.action"
        :class="$style.listItem"
        role="tab"
        tabindex="0"
        :aria-label="item[itemName]"
        ignore-tip
        :disabled="item.disabled ? true : null"
        @click="menuClick(item)"
      >
        {{ item[itemName] }}
      </li>
    </ul>
  </teleport>
</template>

<script>
import { computed } from '@common/utils/vueTools'
import useMenuLocation from '@renderer/utils/compositions/useMenuLocation'

import { appSetting } from '@renderer/store/setting'


export default {
  name: 'MenuToolBar',
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    xy: {
      type: Object,
      required: true,
    },
    menus: {
      type: Array,
      default() {
        return []
      },
    },
    itemName: {
      type: String,
      default: 'name',
    },
  },
  emits: ['update:modelValue', 'menu-click'],
  setup(props, { emit }) {
    const visible = computed(() => props.modelValue)
    const location = computed(() => props.xy)

    const onHide = () => {
      emit('update:modelValue', false)
      menuClick(null)
    }

    const { dom_menu, menuStyles } = useMenuLocation({
      visible,
      location,
      onHide,
    })

    const menuClick = (item) => {
      if (item?.disabled) return
      emit('menu-click', item)
    }

    return {
      dom_menu,
      menuStyles,
      menuClick,
      appSetting,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.list {
  font-size: 12px;
  position: absolute;
  opacity: 0;
  transform: scale(0);
  transform-origin: 0 0 0;
  transition: .14s ease;
  transition-property: transform, opacity;
  border-radius: 12px;
  color: var(--color-font);
  background-color: var(--color-content-background); // 不支持相对颜色时回退
  background-color: var(--q-menu-bg);
  box-shadow: var(--q-menu-border), var(--q-shadow-float);
  backdrop-filter: blur(var(--q-menu-blur)) saturate(1.7);
  z-index: var(--q-z-float);
  overflow: hidden;
  padding: 5px;
  // will-change: transform;
}
.listItem {
  cursor: pointer;
  min-width: 92px;
  line-height: 32px;
  padding: 0 12px;
  text-align: center;
  outline: none;
  border-radius: 8px;
  transition: @transition-normal;
  transition-property: background-color, color;
  box-sizing: border-box;
  .mixin-ellipsis-1();

  &:hover {
    color: var(--color-primary-dark-300);
    background-color: var(--q-menu-hover-bg);
  }
  &:active {
    background-color: var(--q-menu-active-bg);
  }

  &[disabled] {
    cursor: default;
    opacity: .4;
    &:hover {
      background: none !important;
    }
  }
}

</style>
