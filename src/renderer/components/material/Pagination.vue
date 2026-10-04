<template>
  <div v-if="maxPage > 1" :class="$style.pagination">
    <ul>
      <li v-if="page == 1" :class="$style.disabled">
        <span>
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-left" />
          </svg>
        </span>
      </li>
      <li v-else>
        <button type="button" :aria-label="$t('pagination__prev')" @click="handleClick(page - 1)">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-left" />
          </svg>
        </button>
      </li>
      <li v-if="maxPage > btnLength && page > pageEvg+1" :class="$style.first">
        <button type="button" :aria-label="$t('pagination__page', { num: 1 })" @click="handleClick(1)">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-first" />
          </svg>
        </button>
      </li>
      <li v-for="p in pages" :key="p" :class="{[$style.active] : p == page}">
        <span v-if="p === page" v-text="page" />
        <button v-else type="button" :aria-label="$t('pagination__page', { num: p })" @click="handleClick(p)" v-text="p" />
      </li>
      <li v-if="maxPage > btnLength && maxPage - page > pageEvg" :class="$style.last">
        <button type="button" :aria-label="$t('pagination__page', { num: maxPage })" @click="handleClick(maxPage)">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-last" />
          </svg>
        </button>
      </li>
      <li v-if="page == maxPage" :class="$style.disabled">
        <span>
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-right" />
          </svg></span>
      </li>
      <li v-else>
        <button type="button" :aria-label="$t('pagination__next')" @click="handleClick(page + 1)">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-right" />
          </svg>
        </button>
      </li>
    </ul>
    <label v-if="maxPage > btnLength" :class="$style.jump" :title="$t('pagination__jump_tip', { max: maxPage })">
      <span>{{ $t('pagination__jump') }}</span>
      <input
        v-model="jumpValue" type="text" inputmode="numeric" :maxlength="String(maxPage).length"
        :placeholder="String(page)" :aria-label="$t('pagination__jump_tip', { max: maxPage })"
        @keydown.enter="handleJump" @blur="jumpValue = ''"
      >
    </label>
  </div>
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'

export default {
  props: {
    count: {
      type: Number,
      default: 0,
    },
    limit: {
      type: Number,
      default: 10,
    },
    page: {
      type: Number,
      default: 1,
    },
    btnLength: {
      type: Number,
      default: 7,
    },
  },
  emits: ['btn-click'],
  setup(props, { emit }) {
    const maxPage = computed(() => {
      return Math.ceil(props.count / props.limit) || 1
    })
    const pageEvg = computed(() => {
      return Math.floor(props.btnLength / 2)
    })
    const pages = computed(() => {
      if (maxPage.value <= props.btnLength) return Array.from({ length: maxPage.value }, (_, i) => i + 1)
      let start = props.page - pageEvg.value > 1
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        ? maxPage.value - props.page < pageEvg.value + 1
          ? maxPage.value - (props.btnLength - 1)
          : props.page - pageEvg.value
        : 1
      return Array.from({ length: props.btnLength }, (_, i) => start + i)
    })

    const handleClick = (page) => {
      emit('btn-click', page)
    }

    const jumpValue = ref('')
    const handleJump = (event) => {
      const target = parseInt(jumpValue.value, 10)
      jumpValue.value = ''
      if (!Number.isFinite(target)) return
      const page = Math.min(Math.max(target, 1), maxPage.value)
      event.target.blur()
      if (page != props.page) handleClick(page)
    }

    return {
      maxPage,
      pageEvg,
      pages,
      handleClick,
      jumpValue,
      handleJump,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.pagination {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 14px;
  background: rgba(255, 255, 255, .42);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .6), 0 8px 22px rgba(35, 54, 46, .07);
  backdrop-filter: blur(14px);

  ul {
    display: flex;
    flex-flow: row nowrap;
    gap: 2px;

    li {
      display: flex;
      line-height: 1.2;

      svg {
        height: 1em;
        fill: currentColor;
      }
      span,
      button {
        min-width: 32px;
        height: 30px;
        padding: 0 9px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color: var(--color-font);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      }
      &.active {
        span {
          color: #fff;
          font-weight: 650;
          background-color: var(--color-primary);
          box-shadow: 0 6px 14px var(--color-primary-alpha-700);
          animation: q-pagination-active .32s cubic-bezier(.34, 1.56, .64, 1);
        }
      }
      button {
        background-color: transparent;
        border: none;
        cursor: pointer;
        outline: none;
        transition: background-color @transition-fast, color @transition-fast, transform @transition-fast;
        &:hover {
          color: var(--color-primary-dark-100);
          background-color: rgba(255, 255, 255, .62);
        }
        &:focus-visible {
          box-shadow: inset 0 0 0 2px var(--color-primary-alpha-600);
        }
        &:active {
          transform: scale(.92);
        }
      }
      &.disabled {
        span {
          opacity: .3;
        }
      }
    }
  }
}
@keyframes q-pagination-active {
  from { transform: scale(.8); }
  to { transform: scale(1); }
}

.jump {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px 0 10px;
  border-left: 1px solid rgba(54, 83, 70, .12);
  color: var(--color-font-label);
  font-size: 12px;
  white-space: nowrap;

  input {
    width: 44px;
    height: 26px;
    padding: 0 6px;
    box-sizing: border-box;
    border: none;
    border-radius: 8px;
    outline: none;
    color: var(--color-font);
    background: rgba(255, 255, 255, .6);
    box-shadow: inset 0 0 0 1px rgba(54, 83, 70, .12);
    font: inherit;
    font-size: 12px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    transition: box-shadow @transition-fast, background-color @transition-fast;

    &::placeholder { color: var(--color-font-label); opacity: .6; }
    &:focus {
      background: #fff;
      box-shadow: inset 0 0 0 1.5px var(--color-primary);
    }
  }
}

</style>


