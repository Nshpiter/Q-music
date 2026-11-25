<template>
  <ul ref="dom_list" :class="[$style.list, $style[align]]" role="tablist">
    <li
      v-for="item in list"
      :key="item[itemKey]" :class="[$style.listItem, {[$style.active]: modelValue == item[itemKey]}]" :tabindex="modelValue == item[itemKey] ? 0 : -1" role="tab"
      :aria-label="item[itemLabel]" ignore-tip :aria-selected="modelValue == item[itemKey]" :data-tab-key="item[itemKey]" @click="handleToggle(item[itemKey])"
      @keydown="handleKey($event, item[itemKey])"
    >
      <span :class="$style.label">{{ item[itemLabel] }}</span>
    </li>
    <li v-show="indicator.width" aria-hidden="true" :class="[$style.indicator, {[$style.indicatorReady]: indicatorReady}]" :style="{ width: `${indicator.width}px`, transform: `translateX(${indicator.left}px)` }" />
  </ul>
</template>

<script>
import { ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from '@common/utils/vueTools'

export default {
  props: {
    list: {
      type: Array,
      default() {
        return []
      },
    },
    align: {
      type: String,
      default: 'left',
    },
    itemKey: {
      type: String,
      default: 'id',
    },
    itemLabel: {
      type: String,
      default: 'label',
    },
    modelValue: {
      type: [String, Number],
      default: '',
    },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const dom_list = ref(null)
    const indicator = reactive({ left: 0, width: 0 })
    const indicatorReady = ref(false)

    const updateIndicator = () => {
      const list = dom_list.value
      if (!list) return
      const target = Array.from(list.children).find(el => el.dataset?.tabKey != null && el.dataset.tabKey == String(props.modelValue))
      const label = target?.firstElementChild
      if (!label) {
        indicator.width = 0
        return
      }
      // label 的 offsetParent 不一定是 tab，不能叠加两个 offsetLeft。
      const bounds = label.getBoundingClientRect()
      indicator.left = bounds.left - list.getBoundingClientRect().left + list.scrollLeft
      indicator.width = bounds.width
    }

    const handleToggle = id => {
      if (id == props.modelValue) return
      emit('update:modelValue', id)
      emit('change', id)
    }

    const handleKey = (event, id) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ']
      if (!keys.includes(event.key) || !props.list.length) return
      event.preventDefault()
      event.lx_handled = true
      const current = props.list.findIndex(item => item[props.itemKey] == id)
      if (current < 0) return
      let index = current
      if (event.key == 'ArrowLeft') index = (current - 1 + props.list.length) % props.list.length
      if (event.key == 'ArrowRight') index = (current + 1) % props.list.length
      if (event.key == 'Home') index = 0
      if (event.key == 'End') index = props.list.length - 1
      handleToggle(props.list[index][props.itemKey])
      dom_list.value?.children[index]?.focus({ preventScroll: true })
      dom_list.value?.children[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    watch(() => [props.modelValue, props.list], () => {
      void nextTick(updateIndicator)
    }, { deep: true })

    let resizeObserver = null
    onMounted(() => {
      updateIndicator()
      requestAnimationFrame(() => { indicatorReady.value = true })
      if (typeof ResizeObserver != 'undefined' && dom_list.value) {
        resizeObserver = new ResizeObserver(updateIndicator)
        resizeObserver.observe(dom_list.value)
      }
    })
    onBeforeUnmount(() => {
      resizeObserver?.disconnect()
    })

    return {
      dom_list,
      indicator,
      indicatorReady,
      handleToggle,
      handleKey,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.list {
  position: relative;
  display: flex;
  flex-flow: row nowrap;
  font-size: 12px;
  gap: 25px;
  padding: 0 15px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; width: 0; height: 0; }

  &.left {
    justify-content: flex-start;
  }
  &.center {
    .listItem:first-child { margin-left: auto; }
    .listItem:nth-last-child(2) { margin-right: auto; }
  }
  &.right {
    .listItem:first-child { margin-left: auto; }
  }
}
.listItem {
  display: block;
  flex: none;
  cursor: pointer;
  transition: color @transition-normal;
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; border-radius: 6px; }

  &:hover {
    color: var(--color-primary);
  }

  &.active {
    color: var(--color-primary);
    cursor: default;
  }
}

.label {
  display: block;
  position: relative;
  padding: 8px 0;
}

.indicator {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  border-radius: 20px;
  background-color: var(--color-primary-alpha-300);
  pointer-events: none;
}
.indicatorReady {
  transition: transform .36s cubic-bezier(.22, 1, .36, 1), width .36s cubic-bezier(.22, 1, .36, 1);
}
@media (prefers-reduced-motion: reduce) {
  .listItem, .indicatorReady { transition: none; }
}
</style>
