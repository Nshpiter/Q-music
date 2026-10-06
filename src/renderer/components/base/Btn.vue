<template>
  <button
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
  display: inline-block;
  border: none;
  border-radius: @form-radius;
  cursor: pointer;
  padding: 8px 16px;
  color: var(--color-button-font);
  outline: none;
  transition: @transition-fast;
  transition-property: background-color, color, box-shadow, transform, opacity;
  transition-timing-function: cubic-bezier(.2, .8, .2, 1);
  background: linear-gradient(135deg, rgba(255, 255, 255, .58), var(--color-button-background));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .62), 0 8px 18px rgba(70, 88, 106, .06);
  font-size: 14px;
  font-weight: 650;
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
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .72), 0 12px 24px rgba(70, 88, 106, .09);
    transform: translateY(-1px);
  }
  &.outline:hover:not([disabled]) {
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-500), 0 10px 20px rgba(70, 88, 106, .07);
  }
  &:active:not([disabled]) {
    background-color: var(--color-button-background-active);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .6), 0 4px 10px rgba(70, 88, 106, .06);
    transform: translateY(0) scale(.97);
    transition-duration: .08s;
  }
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}

.min {
  padding: 4px 10px;
  font-size: 12px;
}

</style>
