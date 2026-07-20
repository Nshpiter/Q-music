<template>
  <div class="content" :class="[$style.select, show ? $style.active : '']">
    <div ref="dom_btn" class="label-content" :class="$style.label" @click="handleShow">
      <span class="label">{{ label }}</span>
      <div class="icon" :class="$style.icon">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.847 451.847" space="preserve">
          <use xlink:href="#icon-down" />
        </svg>
      </div>
    </div>
    <teleport to="#root">
      <ul v-if="show" ref="dom_list" class="selection-list scroll" :class="$style.list" :style="listStyles">
        <li
          v-for="(item, index) in list" :key="index" :class="[$style.listItem, (itemKey ? item[itemKey] : item) == modelValue ? $style.active : null]"
          :aria-label="itemName ? item[itemName] : item" @click="handleClick(item)"
        >
          {{ itemName ? item[itemName] : item }}
        </li>
      </ul>
    </teleport>
  </div>
</template>

<script>

export default {
  props: {
    list: {
      type: Array,
      default() {
        return []
      },
    },
    modelValue: {
      type: [String, Number],
      required: true,
    },
    itemName: {
      type: String,
      default: '',
    },
    itemKey: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue', 'change'],
  data() {
    return {
      show: false,
      listStyles: {
        transform: 'scaleY(0) translateY(0)',
        opacity: 0,
        pointerEvents: 'none',
      },
      hideTimer: null,
    }
  },
  computed: {
    activeIndex() {
      if (this.modelValue == null) return -1
      if (!this.itemName) return this.list.indexOf(this.modelValue)
      return this.list.findIndex(l => l[this.itemKey] == this.modelValue)
    },
    label() {
      if (this.modelValue == null) return ''
      if (this.itemName == null) return this.modelValue
      const item = this.list[this.activeIndex]
      if (!item) return ''
      return item[this.itemName]
    },
  },
  mounted() {
    document.addEventListener('click', this.handleHide, true)
    document.addEventListener('scroll', this.handleScroll, true)
    window.addEventListener('resize', this.handleHide)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleHide, true)
    document.removeEventListener('scroll', this.handleScroll, true)
    window.removeEventListener('resize', this.handleHide)
    if (this.hideTimer) clearTimeout(this.hideTimer)
  },
  methods: {
    handleHide(e) {
      if (!this.show) return
      // if (e && e.target.parentNode != this.$refs.dom_list && this.show) return this.show = false
      if (e && (e.target == this.$refs.dom_btn || this.$refs.dom_btn.contains(e.target))) return
      if (e && this.$refs.dom_list && (e.target == this.$refs.dom_list || this.$refs.dom_list.contains(e.target))) return
      this.listStyles = {
        ...this.listStyles,
        transform: 'scaleY(0) translateY(0)',
        opacity: 0,
        pointerEvents: 'none',
      }
      if (this.hideTimer) clearTimeout(this.hideTimer)
      this.hideTimer = setTimeout(() => {
        this.show = false
        this.hideTimer = null
      }, 50)
    },
    handleScroll() {
      if (!this.show) return
      this.updateListPosition()
    },
    handleClick(item) {
      // console.log(this.modelValue)
      const value = this.itemKey ? item[this.itemKey] : item
      if (value !== this.modelValue) {
        this.$emit('update:modelValue', value)
        this.$emit('change', item)
      }
      this.handleHide()
    },
    handleShow() {
      if (this.show) {
        this.handleHide()
        return
      }
      if (this.hideTimer) {
        clearTimeout(this.hideTimer)
        this.hideTimer = null
      }
      this.show = true
      this.$nextTick(() => {
        this.updateListPosition()
        if (!this.$refs.dom_list) return

        const activeItem = this.$refs.dom_list.children[this.activeIndex]
        if (activeItem) this.$refs.dom_list.scrollTop = activeItem.offsetTop - this.$refs.dom_list.clientHeight * 0.38
      })
    },
    updateListPosition() {
      if (!this.$refs.dom_btn || !this.$refs.dom_list) return
      const margin = 10
      const gap = 6
      const rect = this.$refs.dom_btn.getBoundingClientRect()
      const listHeight = Math.min(this.$refs.dom_list.scrollHeight, 220)
      const belowHeight = window.innerHeight - rect.bottom - margin
      const aboveHeight = rect.top - margin
      const openUp = belowHeight < listHeight && aboveHeight > belowHeight
      const maxHeight = Math.max(80, Math.min(listHeight, (openUp ? aboveHeight : belowHeight) - gap))
      const top = openUp
        ? Math.max(margin, rect.top - maxHeight - gap)
        : Math.min(rect.bottom + gap, window.innerHeight - margin - maxHeight)
      const left = Math.min(
        Math.max(margin, rect.left),
        Math.max(margin, window.innerWidth - rect.width - margin),
      )

      this.listStyles = {
        left: `${left}px`,
        top: `${top}px`,
        width: `${rect.width}px`,
        maxHeight: `${maxHeight}px`,
        transform: 'scaleY(1) translateY(0)',
        transformOrigin: openUp ? 'center bottom' : 'center top',
        opacity: 1,
        pointerEvents: 'auto',
      }
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@selection-height: 28px;

.select {
  display: inline-block;
  font-size: 12px;
  position: relative;
  width: var(--selection-width, 300px);

  &.active {
    .label {
      background-color: var(--color-button-background);
    }
    .icon {
      svg{
        transform: rotate(180deg);
      }
    }
  }
}

.label {
  background: rgba(255, 255, 255, .52);
  padding: 0 11px;
  transition: @transition-fast;
  transition-property: background-color, color, box-shadow;
  height: @selection-height;
  // line-height: 27px;
  line-height: 1.5;
  box-sizing: border-box;
  color: var(--color-button-font);
  border-radius: @form-radius;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .62), 0 8px 18px rgba(70, 88, 106, .05);
  cursor: pointer;
  display: flex;
  align-items: center;

  span {
    flex: auto;
    .mixin-ellipsis-1();
  }
  .icon {
    flex: none;
    margin-left: 7px;
    line-height: 0;
    svg {
      width: 1em;
      transition: transform .2s ease;
      transform: rotate(0);
    }
  }

  &:hover {
    color: var(--color-primary-dark-300);
    background-color: rgba(255, 255, 255, .68);
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-800), 0 10px 22px rgba(70, 88, 106, .08);
  }
  &:active {
    background-color: var(--color-button-background-active);
  }
}

.list {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--selection-width, 300px);
  background-color: var(--color-content-background); // 回退
  background-color: var(--q-menu-bg);
  opacity: 0;
  transform: scaleY(0) translateY(0);
  transform-origin: center top;
  transition: .25s ease;
  transition-property: transform, opacity;
  border-radius: 12px;
  padding: 5px;
  box-shadow: var(--q-menu-border), var(--q-shadow-float);
  backdrop-filter: blur(var(--q-menu-blur)) saturate(1.7);
  overflow: auto;
  max-height: 200px;
  z-index: var(--q-z-float);
}
.listItem {
  cursor: pointer;
  padding: 0 10px;
  line-height: @selection-height;
  outline: none;
  border-radius: 8px;
  transition: background-color @transition-normal, color @transition-normal;
  background-color: transparent;
  box-sizing: border-box;
  .mixin-ellipsis-1();

  &:hover {
    color: var(--color-primary-dark-300);
    background-color: var(--q-menu-hover-bg);
  }
  &:active {
    background-color: var(--q-menu-active-bg);
  }
  &.active {
    color: var(--color-primary);
    background-color: var(--color-primary-alpha-900);
  }
}


</style>
