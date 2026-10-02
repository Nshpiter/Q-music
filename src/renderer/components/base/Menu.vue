<template>
  <teleport to="#root">
    <ul ref="dom_menu" :class="$style.list" :style="menuStyles" role="menu" :aria-hidden="!modelValue" @keydown="handleKeydown">
      <li v-for="item in visibleMenus" :key="item.action" role="none">
        <button
          type="button" :class="$style.listItem" role="menuitem"
          :tabindex="modelValue && !item.disabled ? 0 : -1"
          :aria-label="item[itemName]" ignore-tip :disabled="!!item.disabled"
          @click="menuClick(item)"
        >
          {{ item[itemName] }}
        </button>
      </li>
    </ul>
  </teleport>
</template>

<script>
import { computed, nextTick, watch } from '@common/utils/vueTools'
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
    const visibleMenus = computed(() => props.menus.filter(item => !item.hide && (item.action != 'download' || appSetting['download.enable'])))
    let previousFocus = null

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

    const handleKeydown = event => {
      if (event.key == 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onHide()
        return
      }
      if (event.key == 'Tab') {
        onHide()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      const items = Array.from(dom_menu.value.querySelectorAll('button:not(:disabled)'))
      if (!items.length) return
      const current = items.indexOf(document.activeElement)
      const index = event.key == 'Home' ? 0 : event.key == 'End' ? items.length - 1 : (current + (event.key == 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[index].focus()
    }

    watch(visible, async(isVisible) => {
      if (!isVisible) {
        if (dom_menu.value?.contains(document.activeElement)) previousFocus?.focus()
        return
      }
      previousFocus = document.activeElement
      await nextTick()
      if (visible.value) dom_menu.value?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true })
    })

    return {
      dom_menu,
      menuStyles,
      menuClick,
      visibleMenus,
      handleKeydown,
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
  max-height: calc(100vh - 28px);
  overflow: auto;
  overscroll-behavior: contain;
  box-sizing: border-box;
  padding: 5px;
  // will-change: transform;
}
.listItem {
  cursor: pointer;
  display: block;
  width: 100%;
  min-width: 92px;
  border: none;
  color: inherit;
  background: transparent;
  font: inherit;
  line-height: 32px;
  padding: 0 12px;
  text-align: center;
  outline: none;
  border-radius: 8px;
  transition: @transition-normal;
  transition-property: background-color, color;
  box-sizing: border-box;
  .mixin-ellipsis-1();

  &:hover, &:focus-visible {
    color: var(--color-primary-dark-300);
    background-color: var(--q-menu-hover-bg);
  }
  &:active {
    background-color: var(--q-menu-active-bg);
  }

  &:disabled {
    cursor: default;
    opacity: .4;
    &:hover {
      background: none !important;
    }
  }
}

</style>
