<template>
  <ul ref="dom_list" :class="[$style.list, $style[align]]" role="tablist">
    <li
      v-for="item in list"
      :key="item[itemKey]" :class="[$style.listItem, {[$style.active]: modelValue == item[itemKey]}]" tabindex="-1" role="tab"
      :aria-label="item[itemLabel]" ignore-tip :aria-selected="modelValue == item[itemKey]" :data-tab-key="item[itemKey]" @click="handleToggle(item[itemKey])"
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
      indicator.left = target.offsetLeft + label.offsetLeft
      indicator.width = label.offsetWidth
    }

    const handleToggle = id => {
      if (id == props.modelValue) return
      emit('update:modelValue', id)
      emit('change', id)
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

  &.left {
    justify-content: flex-start;
  }
  &.center {
    justify-content: center;
  }
  &.right {
    justify-content: flex-end;
  }
}
.listItem {
  display: block;
  cursor: pointer;
  transition: color @transition-normal;

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
  transition: transform .32s cubic-bezier(.2, .8, .2, 1), width .32s cubic-bezier(.2, .8, .2, 1);
}
</style>
