<template lang="pug">
material-modal(:show="modelValue" teleport="#view" @close="handleCloseModal" @after-enter="$refs.dom_input.focus()")
  main(:class="$style.main")
    h2 {{ $t('play_timeout') }}
    div(:class="$style.content")
      div(:class="[$style.row, $style.inputGroup]")
        base-input(ref="dom_input" v-model="time" :class="$style.input" inputmode="numeric" :aria-label="$t('play_timeout')" :aria-invalid="!!error" aria-describedby="play-timeout-hint" @submit="handleConfirm")
        p(:class="$style.inputLabel") {{ $t('play_timeout_unit') }}
      p#play-timeout-hint(:class="$style.hint" role="status") {{ error || $t('play_timeout_range') }}
      div(:class="$style.presets")
        button(v-for="minutes in [15, 30, 60, 90]" :key="minutes" type="button" :aria-pressed="Number(time) == minutes" @click="time = String(minutes)") {{ minutes }} {{ $t('play_timeout_unit') }}
      div(:class="$style.row")
        base-checkbox(id="play_timeout_end" :model-value="appSetting['player.waitPlayEndStop']" :label="$t('play_timeout_end')" @update:model-value="updateSetting({'player.waitPlayEndStop': $event})")
      div(:class="[$style.row, $style.tip, { [$style.show]: !!timeLabel }]")
        p {{ $t('play_timeout_tip', { time: timeLabel }) }}
    div(:class="$style.footer")
      base-btn(:class="$style.footerBtn" @click="handleCancel") {{ $t(timeLabel ? 'play_timeout_stop' : 'play_timeout_close') }}
      base-btn(:class="$style.footerBtn" @click="handleConfirm") {{ $t(timeLabel ? 'play_timeout_update' : 'play_timeout_confirm') }}
</template>

<script>
import { useTimeout, startTimeoutStop, stopTimeoutStop } from '@renderer/core/player/timeoutStop'
import { ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting, updateSetting } from '@renderer/store/setting'

const MAX_MIN = 1440

const rxp = /^[1-9]\d*$/

export default {
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { timeLabel } = useTimeout()
    const time = ref(appSetting['player.waitPlayEndStopTime'])
    const error = ref('')
    const t = useI18n()
    watch(() => props.modelValue, visible => {
      if (!visible) return
      time.value = appSetting['player.waitPlayEndStopTime']
      error.value = ''
    })
    watch(time, () => { error.value = '' })

    const handleCloseModal = () => {
      emit('update:modelValue', false)
    }
    const handleCancel = () => {
      if (timeLabel.value) {
        stopTimeoutStop()
      }
      handleCloseModal()
    }
    const verify = () => {
      const text = String(time.value).trim()
      if (!rxp.test(text) || Number(text) > MAX_MIN) {
        error.value = t('play_timeout_range')
        return ''
      }
      return Number(text)
    }
    const handleConfirm = () => {
      let time = verify()
      if (time == '') return
      if (appSetting['player.waitPlayEndStopTime'] != time) updateSetting({ 'player.waitPlayEndStopTime': time })
      startTimeoutStop(time * 60)
      handleCloseModal()
    }
    return {
      appSetting,
      updateSetting,
      timeLabel,
      time,
      error,
      handleCloseModal,
      handleCancel,
      handleConfirm,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 15px;
  max-width: 530px;
  min-width: 280px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  min-height: 0;
  // max-height: 100%;
  // overflow: hidden;
  h2 {
    font-size: 16px;
    color: var(--color-font);
    line-height: 1.3;
    text-align: center;
  }
}
.content {
  padding-top: 15px;
  font-size: 14px;
}
.row {
  padding-top: 5px;
}
.inputGroup {
  display: flex;
  align-items: center;
}
.input {
  flex: auto;
  min-width: 0;
}
.hint {
  margin-top: 8px;
  color: var(--color-font-label);
  font-size: 12px;
  line-height: 1.5;
}
.presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 12px 0;
  button {
    padding: 8px 4px;
    border: 1px solid var(--color-primary-light-400);
    border-radius: 6px;
    color: var(--color-font);
    background: transparent;
    cursor: pointer;
    &[aria-pressed='true'] {
      color: var(--color-primary);
      background: var(--color-primary-alpha-900);
    }
    &:focus-visible { outline: 2px solid var(--color-primary); }
  }
}
.inputLabel {
  flex: none;
  margin-left: 10px;
}
.tip {
  visibility: hidden;

  &.show {
    visibility: visible;
  }
}
.footer {
  margin-top: 20px;
  display: flex;
  flex-flow: row nowrap;
}
.footerBtn {
  flex: auto;
  height: 36px;
  line-height: 36px;
  padding: 0 10px !important;
  width: 150px;
  .mixin-ellipsis-1();
  + .footerBtn {
    margin-left: 15px;
  }
}
.ruleLink {
  .mixin-ellipsis-1();
}

</style>
