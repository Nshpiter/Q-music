<template>
  <div :class="$style.btns" :aria-busy="disabled">
    <button v-if="playBtn" type="button" :disabled="disabled" :aria-label="$t(playing ? 'player__pause' : 'list__play')" @contextmenu.capture.stop @click.stop="handleClick('play')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><use :href="playing ? '#icon-pause' : '#icon-play'" /></svg>
    </button>
    <button v-if="listAddBtn" type="button" :disabled="disabled" :aria-label="$t('list__add_to')" @contextmenu.capture.stop @click.stop="handleClick('listAdd')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-list-add" /></svg>
    </button>
    <button v-if="downloadBtn && appSetting['download.enable']" type="button" :disabled="disabled" :aria-label="$t('list__download')" @contextmenu.capture.stop @click.stop="handleClick('download')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-download-2" /></svg>
    </button>
    <button v-if="startBtn" type="button" :disabled="disabled" :aria-label="$t('list__start')" @contextmenu.capture.stop @click.stop="handleClick('start')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-play" /></svg>
    </button>
    <button v-if="pauseBtn" type="button" :disabled="disabled" :aria-label="$t('list__pause')" @contextmenu.capture.stop @click.stop="handleClick('pause')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-pause" /></svg>
    </button>
    <button v-if="fileBtn" type="button" :disabled="disabled" :aria-label="$t('list__file')" @contextmenu.capture.stop @click.stop="handleClick('file')">
      <svg viewBox="0 0 24 24" :class="$style.outlineIcon" aria-hidden="true"><path d="M3.5 8V6a1.5 1.5 0 0 1 1.5-1.5h4.3L12 7h7A1.5 1.5 0 0 1 20.5 8.5v10A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M4 10h16" /></svg>
    </button>
    <button v-if="searchBtn" type="button" :disabled="disabled" :aria-label="$t('list__search')" @contextmenu.capture.stop @click.stop="handleClick('search')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-search-2" /></svg>
    </button>
    <button v-if="removeBtn" type="button" :disabled="disabled" :aria-label="removeLabel || $t('list__remove')" @click.stop="handleClick('remove')">
      <svg viewBox="0 0 24 24" :class="$style.outlineIcon" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
  </div>
</template>

<script>
import { appSetting } from '@renderer/store/setting'

export default {
  props: {
    index: {
      type: Number,
      required: true,
    },
    playing: {
      type: Boolean,
      default: false,
    },
    disabled: Boolean,
    removeLabel: { type: String, default: '' },
    startBtn: {
      type: Boolean,
      default: false,
    },
    pauseBtn: {
      type: Boolean,
      default: false,
    },
    removeBtn: {
      type: Boolean,
      default: false,
    },
    downloadBtn: {
      type: Boolean,
      default: true,
    },
    playBtn: {
      type: Boolean,
      default: true,
    },
    listAddBtn: {
      type: Boolean,
      default: true,
    },
    searchBtn: {
      type: Boolean,
      default: false,
    },
    fileBtn: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['btn-click'],
  setup() {
    return {
      appSetting,
    }
  },
  methods: {
    handleClick(action) {
      if (this.disabled) return
      this.$emit('btn-click', { action, index: this.index })
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.btns {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  line-height: 1.2;

  button {
    background-color: transparent;
    border: none;
    border-radius: 8px;
    flex: none;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 6px;
    color: color-mix(in srgb, var(--color-font) 80%, transparent);
    outline: none;
    transition: background-color 0.2s ease;
    line-height: 0;
    &:last-child {
      margin-right: 0;
    }

    svg {
      width: 16px;
      height: 16px;
    }

    &:disabled { opacity: .4; cursor: default; }
    &:hover:not(:disabled) {
      color: var(--color-font);
      background-color: var(--q-icon-btn-hover-bg);
    }
    &:active:not(:disabled) {
      background-color: var(--color-button-background-active);
    }
    .outlineIcon { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: -2px;
      background-color: var(--color-button-background-hover);
    }
  }
}

</style>
