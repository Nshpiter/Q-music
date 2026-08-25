<template>
  <svg :class="$style.mark" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M7 18v-4" />
    <path d="M11.5 22V10" />
    <path d="M16 19V13" />
    <path d="M20.5 23V9" />
    <path d="M25 18v-4" />
  </svg>
</template>

<style lang="less" module>
.mark {
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.25;
  stroke-linecap: round;
}
</style>
