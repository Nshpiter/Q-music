<template>
  <div :class="[$style.row, { [$style.active]: active }]">
    <button type="button" :class="$style.track" :title="displayInfo.name" @click="$emit('play')">
      <span :class="$style.index" aria-hidden="true">
        <svg v-if="active" viewBox="0 0 24 24">
          <path d="M9 7v10l8-5-8-5z" />
        </svg>
        <span v-else>{{ index + 1 }}</span>
      </span>
      <span :class="$style.info">
        <span :class="$style.name">{{ displayInfo.name }}</span>
        <span :class="$style.singer">{{ displayInfo.singer || '--' }}</span>
      </span>
      <span :class="$style.duration">{{ displayInfo.interval || '--:--' }}</span>
    </button>
    <button
      v-if="removable"
      type="button"
      :class="$style.remove"
      :aria-label="$t('play_queue__remove')"
      :title="$t('play_queue__remove')"
      @click.stop="$emit('remove')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from '@common/utils/vueTools'

const props = defineProps<{
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem
  index: number
  active?: boolean
  removable?: boolean
}>()

defineEmits<{
  play: []
  remove: []
}>()

const displayInfo = computed(() => {
  return 'progress' in props.musicInfo ? props.musicInfo.metadata.musicInfo : props.musicInfo
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.row {
  position: relative;
  height: 56px;
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid rgba(54, 83, 70, .08);
  transition: background-color @transition-fast;

  &:hover {
    background-color: rgba(67, 118, 94, .06);

    .remove {
      opacity: .8;
    }
  }

  &.active {
    color: var(--color-primary);
    background-color: var(--color-primary-background-hover);

    &:before {
      content: '';
      position: absolute;
      left: 0;
      top: 9px;
      bottom: 9px;
      width: 3px;
      border-radius: 0 2px 2px 0;
      background-color: var(--color-primary);
    }
  }
}

.track {
  min-width: 0;
  flex: auto;
  padding: 0 12px 0 10px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 8px;
  border: none;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.index {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(54, 58, 60, .5);
  font-size: 12px;
  font-variant-numeric: tabular-nums;

  svg {
    width: 17px;
    height: 17px;
    fill: currentColor;
  }
}

.info {
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 3px;
}

.name,
.singer {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.name {
  color: inherit;
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
}

.singer {
  color: rgba(54, 58, 60, .54);
  font-size: 11px;
  line-height: 16px;
}

.duration {
  color: rgba(54, 58, 60, .48);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.remove {
  width: 32px;
  height: 32px;
  margin: 12px 8px 12px 0;
  padding: 0;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  color: rgba(54, 58, 60, .58);
  background: transparent;
  cursor: pointer;
  opacity: .28;
  transition: opacity @transition-fast, color @transition-fast, background-color @transition-fast;

  &:hover {
    color: #d65555;
    background-color: rgba(214, 85, 85, .09);
    opacity: 1 !important;
  }

  svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
}
</style>
