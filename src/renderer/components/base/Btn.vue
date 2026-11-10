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
  cursor: pointer;
  padding: 8px 16px;
  color: var(--color-button-font);
  outline: none;
  transition: @transition-fast;
  transition-property: background-color, color, box-shadow, transform, opacity;
  transition-timing-function: cubic-bezier(.2, .8, .2, 1);
  background: var(--color-button-background);
  box-shadow: inset 0 0 0 1px var(--q-border);
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
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-800);
  }

  &:hover:not([disabled]) {
    color: var(--color-primary-dark-300);
    background-color: var(--color-button-background-hover);
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-700);
  }
  &.outline:hover:not([disabled]) {
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-500);
  }
  &:active:not([disabled]) {
    background-color: var(--color-button-background-active);
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-600);
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
