<template>
  <button
    type="button"
    :class="[$style.btn, {[$style.min]: min}, {[$style.outline]: outline}]"
    tabindex="0"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script>
export default {
  props: {
    min: {
      type: Boolean,
    },
    outline: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  box-sizing: border-box;
  min-height: 32px;
  gap: 6px;
  border: none;
  border-radius: @form-radius;
  overflow: hidden;
  cursor: pointer;
  padding: 8px 16px;
  color: var(--color-font);
  outline: none;
  transition: @transition-fast;
  transition-property: background-color, color, box-shadow, transform, opacity;
  transition-timing-function: cubic-bezier(.2, .8, .2, 1);
  background: rgb(from var(--color-font) r g b / .045);
  box-shadow: inset 0 0 0 1px var(--q-outline);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.4;
  letter-spacing: 0;
  &[disabled] {
    opacity: .4;
    cursor: default;
    box-shadow: none;
  }

  &.outline {
    background-color: transparent;
    background-image: none;
    box-shadow: inset 0 0 0 1px var(--q-outline);
  }

  &:hover:not([disabled]) {
    color: var(--color-font);
    background-color: rgb(from var(--color-font) r g b / .085);
    box-shadow: inset 0 0 0 1px rgb(from var(--color-font) r g b / .14);
  }
  &.outline:hover:not([disabled]) {
    box-shadow: inset 0 0 0 1px rgb(from var(--color-font) r g b / .16);
  }
  &:active:not([disabled]) {
    background-color: rgb(from var(--color-font) r g b / .12);
    box-shadow: inset 0 0 0 1px rgb(from var(--color-font) r g b / .16);
    transform: translateY(0) scale(.97);
    transition-duration: .08s;
  }
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}

.min {
  min-height: 26px;
  padding: 4px 10px;
  font-size: 12px;
}

</style>
