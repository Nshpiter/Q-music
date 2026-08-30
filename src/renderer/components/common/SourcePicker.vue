<template>
  <span :class="$style.root">
    <button
      v-if="hasAlternatives"
      ref="triggerRef"
      type="button"
      :class="[$style.trigger, { [$style.open]: isOpen }]"
      :title="currentSourceName"
      :aria-label="currentSourceName"
      :aria-expanded="hasAlternatives ? isOpen : undefined"
      :aria-haspopup="hasAlternatives ? 'menu' : undefined"
      :disabled="!hasAlternatives"
      @click.stop="toggle"
      @keydown.esc.stop.prevent="close"
    >
      <source-icon :source="currentSource" :size="18" :label="currentSourceName" />
      <i v-if="hasAlternatives" :class="$style.chevron" aria-hidden="true" />
    </button>
    <span v-else :class="$style.staticIcon" :title="currentSourceName">
      <source-icon :source="currentSource" :size="18" :label="currentSourceName" />
    </span>

    <teleport to="#root">
      <div
        v-if="isOpen"
        ref="menuRef"
        :class="$style.menu"
        :style="menuStyle"
        role="menu"
        :aria-label="currentSourceName"
        @click.stop
      >
        <button
          v-for="(source, index) in normalizedOptions"
          :key="source"
          ref="optionRefs"
          type="button"
          role="menuitemradio"
          :aria-checked="source == currentSource"
          :class="[$style.option, { [$style.optionActive]: source == currentSource }]"
          :title="sourceName(source)"
          @click="select(source)"
          @keydown="handleOptionKeydown($event, index, source)"
        >
          <source-icon :source="source" :size="18" :label="sourceName(source)" />
          <span>{{ sourceName(source) }}</span>
          <svg v-if="source == currentSource" :class="$style.check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </button>
      </div>
    </teleport>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from '@common/utils/vueTools'
import SourceIcon from './SourceIcon.vue'

const props = withDefaults(defineProps<{
  value: string
  options?: string[]
  sourceName?: (source: string) => string
}>(), {
  options: () => [],
  sourceName: (source: string) => source,
})

const emit = defineEmits<(event: 'change', source: string) => void>()

const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const optionRefs = ref<HTMLElement[]>([])
const isOpen = ref(false)
const menuPosition = ref({ left: 0, top: 0, origin: 'top left' })

const normalizedOptions = computed<string[]>(() => {
  const values: string[] = Array.isArray(props.options) ? props.options.filter(Boolean) : []
  const unique: string[] = [...new Set<string>(values)]
  if (props.value && !unique.includes(props.value)) unique.unshift(props.value)
  return unique
})
const currentSource = computed(() => props.value || normalizedOptions.value[0] || 'local')
const currentSourceName = computed(() => props.sourceName(currentSource.value))
const hasAlternatives = computed(() => normalizedOptions.value.length > 1)
const menuStyle = computed(() => ({
  left: `${menuPosition.value.left}px`,
  top: `${menuPosition.value.top}px`,
  transformOrigin: menuPosition.value.origin,
}))

const updatePosition = () => {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const menu = menuRef.value
  const margin = 10
  const gap = 6
  const width = menu?.offsetWidth ?? 164
  const height = menu?.offsetHeight ?? Math.min(12 + normalizedOptions.value.length * 34, 260)
  const viewportWidth = document.documentElement.clientWidth ?? window.innerWidth
  const viewportHeight = document.documentElement.clientHeight ?? window.innerHeight
  const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin))
  const canOpenAbove = rect.top - height - gap >= margin
  const top = canOpenAbove
    ? rect.top - height - gap
    : Math.min(rect.bottom + gap, viewportHeight - height - margin)
  menuPosition.value = {
    left,
    top: Math.max(margin, top),
    origin: canOpenAbove ? 'bottom left' : 'top left',
  }
}

const bindFloatingListeners = () => {
  document.addEventListener('pointerdown', handleOutside, true)
  document.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
}
const unbindFloatingListeners = () => {
  document.removeEventListener('pointerdown', handleOutside, true)
  document.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
}

const close = () => {
  if (!isOpen.value) return
  isOpen.value = false
  unbindFloatingListeners()
}
const handleOutside = (event: Event) => {
  const target = event.target as Node | null
  const insideTrigger = target ? (triggerRef.value?.contains(target) ?? false) : false
  const insideMenu = target ? (menuRef.value?.contains(target) ?? false) : false
  if (insideTrigger ? true : insideMenu) return
  close()
}
const toggle = () => {
  if (!hasAlternatives.value) return
  if (isOpen.value) {
    close()
    return
  }
  isOpen.value = true
  bindFloatingListeners()
  void nextTick(() => {
    updatePosition()
    optionRefs.value.find((element, index) => normalizedOptions.value[index] == currentSource.value)?.focus()
  })
}
const select = (source: string) => {
  if (source != currentSource.value) emit('change', source)
  close()
  void nextTick(() => triggerRef.value?.focus())
}
const handleOptionKeydown = (event: KeyboardEvent, index: number, source: string) => {
  if (event.key == 'Escape') {
    event.preventDefault()
    close()
    void nextTick(() => triggerRef.value?.focus())
    return
  }
  if (event.key == 'ArrowDown' || event.key == 'ArrowUp') {
    event.preventDefault()
    const offset = event.key == 'ArrowDown' ? 1 : -1
    const nextIndex = (index + offset + normalizedOptions.value.length) % normalizedOptions.value.length
    optionRefs.value[nextIndex]?.focus()
    return
  }
  if (event.key == 'Enter' || event.key == ' ') {
    event.preventDefault()
    select(source)
  }
}

watch(isOpen, (visible) => {
  if (!visible) optionRefs.value = []
})
onBeforeUnmount(unbindFloatingListeners)
</script>

<style lang="less" module>
.root {
  display: inline-flex;
  flex: none;
  vertical-align: middle;
  margin-left: 6px;
}

.trigger {
  width: 30px;
  height: 25px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--color-font-label);
  border: 1px solid transparent;
  border-radius: 8px;
  background: rgb(from var(--color-font) r g b / .045);
  cursor: pointer;
  transition: color .15s ease, background-color .15s ease, border-color .15s ease, transform .15s ease, box-shadow .15s ease;

  &:hover,
  &.open {
    color: var(--color-primary);
    border-color: var(--color-primary-alpha-600);
    background: var(--color-primary-alpha-900);
    box-shadow: 0 4px 10px rgb(from var(--color-primary) r g b / .09);
  }
  &:active { transform: scale(.94); }
  &:focus-visible { outline: 2px solid var(--color-primary-alpha-500); outline-offset: 2px; }
}

.staticIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 25px;
}

.chevron {
  width: 5px;
  height: 5px;
  flex: none;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg) translate(-1px, -1px);
  transition: transform .15s ease;
  .open & { transform: rotate(225deg) translate(-1px, -1px); }
}

.menu {
  position: fixed;
  z-index: var(--q-z-float);
  width: 164px;
  max-width: calc(100vw - 20px);
  padding: 6px;
  box-sizing: border-box;
  color: var(--color-font);
  border: 1px solid rgb(from var(--color-font) r g b / .1);
  border-radius: 13px;
  background: rgb(from var(--color-content-background) r g b / .94);
  box-shadow: 0 16px 38px rgba(28, 42, 35, .2), inset 0 1px rgba(255, 255, 255, .72);
  backdrop-filter: blur(22px) saturate(1.35);
  animation: popIn .14s cubic-bezier(.2, .8, .2, 1);
}

.option {
  width: 100%;
  min-height: 34px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-font-label);
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: color .14s ease, background-color .14s ease, border-color .14s ease, transform .14s ease;

  &:hover {
    color: var(--color-font);
    background: var(--q-menu-hover-bg);
  }
  &:active { transform: scale(.98); }
  &:focus-visible { outline: 2px solid var(--color-primary-alpha-500); outline-offset: 2px; }
  > span {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.optionActive {
  color: var(--color-primary);
  border-color: var(--color-primary-alpha-600);
  background: var(--color-primary-alpha-900);
}

.check {
  width: 15px;
  height: 15px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@keyframes popIn {
  from { opacity: 0; transform: translateY(4px) scale(.97); }
  to { opacity: 1; transform: none; }
}
</style>
