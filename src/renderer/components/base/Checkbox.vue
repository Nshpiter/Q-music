<template>
  <div :class="$style.checkbox">
    <input
      :id="id" ref="dom_input" :type="need ? 'radio' : 'checkbox'" :aria-hidden="true" :checked="checked"
      :class="$style.input" :disabled="disabled" :value="value" :name="name" @input="handleInput($event.target.checked)"
    >
    <label :for="id" :class="$style.content">
      <div :class="$style.container" :role="need ? 'radio' : 'checkbox'" tabindex="0" :aria-label="ariaLabel || label" :aria-checked="checked" :aria-disabled="disabled" @keydown.enter.space.stop.prevent="handleToggle">
        <svg version="1.1" :class="$style.icon" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" width="100%" viewBox="0 32 448 448" space="preserve">
          <use xlink:href="#icon-check-true" />
        </svg>
      </div>
      <slot v-if="label == null" />
      <span v-else :class="$style.label">
        {{ label }}
      </span>
    </label>
  </div>
</template>

<script>
export default {
  props: {
    modelValue: {
      type: [String, Boolean, Number, Array],
      required: true,
    },
    value: {
      type: [String, Boolean, Number, Array],
      default: undefined,
    },
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: undefined,
    },
    need: {
      type: Boolean,
      default: false,
    },
    ariaLabel: {
      type: String,
      default: undefined,
    },
    label: {
      type: String,
      default: undefined,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'change'],
  data() {
    return {
      checked: false,
    }
  },
  watch: {
    modelValue(n) {
      this.setValue(n)
    },
  },
  mounted() {
    this.setValue(this.modelValue)
  },
  methods: {
    handleInput(checked) {
      let modelValue
      if (Array.isArray(this.modelValue)) {
        modelValue = [...this.modelValue]
        if (checked) modelValue.push(this.value)
        else {
          const index = modelValue.indexOf(this.value)
          if (index > -1) modelValue.splice(index, 1)
        }
      } else {
        if (typeof this.modelValue == 'boolean') {
          modelValue = checked
        } else modelValue = checked ? this.value : ''
      }
      this.$emit('update:modelValue', modelValue)
      this.$emit('change', modelValue)
    },
    setValue(value) {
      let checked
      if (Array.isArray(value)) {
        checked = value.includes(this.value)
      } else {
        if (typeof this.modelValue == 'boolean') {
          checked = this.modelValue
        } else if (value == null) checked = this.modelValue != ''
        else checked = this.modelValue == this.value
      }
      // console.log(this.need, this.value, checked)
      // this.checked = this.need ? checked && this.value : checked
      if (this.checked == checked) return
      this.checked = checked
    },
    handleToggle(event) {
      event.lx_handled = true
      if (this.need) {
        if (this.$refs.dom_input.checked) return
        this.$refs.dom_input.checked = true
        this.handleInput(true)
      } else {
        this.$refs.dom_input.checked = !this.$refs.dom_input.checked
        this.handleInput(this.$refs.dom_input.checked)
      }
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.checkbox {
  display: inline-block;
  // font-size: 56px;
}
.input {
  display: none;
  &[disabled] {
    + .content {
      opacity: .5;
      .container, .label {
        cursor: default;
      }
    }
  }
  &:checked {
    + .content {
      .container {
        &:after {
          border-color: var(--color-primary);
          background: var(--color-primary-alpha-900);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .55), 0 0 0 3px var(--color-primary-alpha-900);
        }
      }
      .icon {
        transform: scale(1);
        opacity: 1;
      }
    }
  }
  &:not([disabled]) + .content:hover .container:after {
    border-color: var(--color-primary);
    background: rgba(255, 255, 255, .72);
  }
  &:not([disabled]):checked + .content:hover .container:after {
    background: var(--color-primary-alpha-800);
  }
  &:not([disabled]) + .content:active .container {
    transform: scale(.9);
  }
}
.content {
  display: flex;
  align-items: center;
  min-height: 26px;
}
.container {
  flex: none;
  position: relative;
  width: 1.15em;
  height: 1.15em;
  cursor: pointer;
  display: flex;
  color: var(--color-primary);
  border-radius: 7px;
  outline: none;
  transition: transform .14s cubic-bezier(.2, .8, .2, 1);
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  // border: 1px solid #ccc;
  &:after {
    position: absolute;
    content: ' ';
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    border: 1px solid var(--color-primary-alpha-700);
    background: rgba(255, 255, 255, .58);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .55);
    transition: @transition-fast;
    transition-property: border-color, background-color, box-shadow;
    border-radius: 7px;
  }
}
.icon {
  position: relative;
  z-index: 1;
  transition: transform .28s cubic-bezier(.34, 1.56, .64, 1), opacity .16s ease;
  transform: scale(0);
  opacity: 0;
  border-radius: 7px;
}

.label {
  flex: auto;
  margin-left: 8px;
  line-height: 1.5;
  cursor: pointer;
}

</style>
