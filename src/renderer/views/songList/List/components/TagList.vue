<template>
  <div :class="[$style.tagList, {[$style.active]: popupVisible}]">
    <button id="songlist-category-trigger" ref="dom_btn" type="button" :class="$style.label" :aria-expanded="popupVisible" aria-controls="songlist-categories" @click.stop="handleShow">
      <span>{{ tagName }}</span>
      <div :class="$style.icon">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.847 451.847" space="preserve">
          <use xlink:href="#icon-down" />
        </svg>
      </div>
    </button>
    <div id="songlist-categories" :class="$style.popup" :style="popupStyle" role="region" aria-labelledby="songlist-category-trigger" :aria-hidden="!popupVisible" :inert="!popupVisible || undefined" @click.stop>
      <div :class="$style.list" class="scroll">
        <button type="button" :class="[$style.tag, {[$style.selected]: !props.tagId}]" :aria-pressed="!props.tagId" @click="handleToggleTag('')">{{ $t('default') }}</button>
        <dl v-for="tagInfo in list" :key="tagInfo.name">
          <dt :class="$style.type">{{ tagInfo.name }}</dt>
          <dd v-for="tag in tagInfo.list" :key="tag.id"><button type="button" :class="[$style.tag, {[$style.selected]: props.tagId == tag.id}]" :aria-pressed="props.tagId == tag.id" @click="handleToggleTag(tag.id)">{{ tag.name }}</button></dd>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch, shallowReactive, ref, onMounted, onBeforeUnmount, computed, reactive } from '@common/utils/vueTools'
import { setTags, getTags } from '@renderer/store/songList/action'
import { tags } from '@renderer/store/songList/state'
import { useRouter, useRoute } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'

const props = defineProps({
  source: {
    type: String,
    required: true,
  },
  tagId: {
    type: String,
    required: true,
  },
  sortId: {
    type: [String, undefined],
    default: undefined,
  },
})

const router = useRouter()
const route = useRoute()
const t = useI18n()

const popupVisible = ref(false)
const list = shallowReactive([])
let requestId = 0
const handleToggleTag = (id) => {
  void router.replace({
    path: route.path,
    query: {
      source: props.source,
      tagId: id,
      sortId: props.sortId,
    },
  })
  handleHide()
  dom_btn.value?.focus()
}
watch(() => props.source, async(source) => {
  if (!source) return
  const currentRequestId = ++requestId
  list.splice(0, list.length)
  popupVisible.value = false
  // const source = (await getLeaderboardSetting()).source as LX.OnlineSource
  let tagInfo = tags[source]
  // console.log(await getTags(source))
  try {
    if (tagInfo == null) setTags(tagInfo = await getTags(source), source)
  } catch (error) {
    if (currentRequestId == requestId) list.splice(0, list.length)
    console.warn(`Failed to load song list tags: ${source}`, error)
    return
  }
  if (currentRequestId != requestId || source != props.source) return

  list.splice(0, list.length, ...[{ name: window.i18n.t('songlist__tag_info_hot_tag'), list: [...tagInfo.hotTag] }, ...tagInfo.tags])
}, {
  immediate: true,
})
const tagName = computed(() => {
  if (!props.tagId) return t('default')
  for (const tags of list) {
    const tag = tags.list.find(t => t.id == props.tagId)
    if (tag) return tag.name
  }
  return props.tagId
})

const popupStyle = reactive({ width: '0px', maxHeight: '0px', left: '0px', '--arrow-left': '20px' })

// 按按钮的实际位置约束面板，而不是从按钮处再展开几乎整个页面宽度。
const updatePopupBounds = () => {
  const button = dom_btn.value
  const view = document.getElementById('view')
  const page = button?.closest('.view-container')
  if (!button || !view || !page) return
  const bounds = view.getBoundingClientRect()
  const anchor = button.getBoundingClientRect()
  const parent = button.parentElement.getBoundingClientRect()
  const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const start = Math.max(0, bounds.left) + 12
  const end = Math.min(window.innerWidth, bounds.right) - 12
  const width = Math.max(0, Math.min(42 * fontSize, end - start))
  const left = Math.max(start, Math.min(anchor.left, end - width))
  // 歌单页底部的 padding 为迷你播放器预留空间，分类滚动也应止于这里。
  const bottom = Math.min(window.innerHeight, page.getBoundingClientRect().bottom - parseFloat(getComputedStyle(page).paddingBottom))
  popupStyle.width = `${width}px`
  popupStyle.left = `${left - parent.left}px`
  popupStyle.maxHeight = `${Math.max(0, bottom - anchor.bottom - 20)}px`
  popupStyle['--arrow-left'] = `${Math.max(16, Math.min(width - 32, anchor.left + anchor.width / 2 - left - 8))}px`
}

const dom_btn = ref(null)
const handleShow = () => {
  if (!popupVisible.value) updatePopupBounds()
  popupVisible.value = !popupVisible.value
}
const handleHide = (evt) => {
  // if (e && e.target.parentNode != this.$refs.dom_popup && this.show) return this.show = false
  // console.log(this.$refs)
  if (evt && (evt.target == dom_btn.value || dom_btn.value?.contains(evt.target))) return
  popupVisible.value = false
}

const handleKeydown = event => {
  if (event.key != 'Escape' || !popupVisible.value) return
  event.stopPropagation()
  handleHide()
  dom_btn.value?.focus()
}
let resizeObserver

onMounted(() => {
  resizeObserver = new ResizeObserver(() => { if (popupVisible.value) updatePopupBounds() })
  resizeObserver.observe(document.getElementById('view'))
  resizeObserver.observe(dom_btn.value)
  document.addEventListener('click', handleHide)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updatePopupBounds)
})

onBeforeUnmount(() => {
  requestId++
  resizeObserver?.disconnect()
  document.removeEventListener('click', handleHide)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updatePopupBounds)
})

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.tagList {
  font-size: 12px;
  position: relative;

  &.active {
    .label {
      color: var(--color-primary-dark-200);
      background-color: var(--color-button-background);
      box-shadow: inset 0 0 0 1px var(--color-primary-alpha-700);
      .icon svg {
        transform: rotate(180deg);
      }
    }
    .popup {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: initial;
    }
  }
}

.label {
  border: 0;
  background: var(--q-surface);
  box-shadow: inset 0 0 0 1px var(--q-border);
  font: inherit;
  min-height: 32px;
  border-radius: 10px;
  padding: 0 13px;
  transition: background-color @transition-fast, color @transition-fast, box-shadow @transition-fast, transform @transition-fast;
  box-sizing: border-box;
  text-align: center;
  color: var(--color-button-font);
  font-weight: 550;
  cursor: pointer;
  display: inline-flex;
  align-items: center;

  span {
    flex: auto;
  }
  .icon {
    flex: none;
    margin-left: 7px;
    line-height: 0;
    svg {
      width: .8em;
      transition: transform .22s cubic-bezier(.22, 1, .36, 1);
      transform: rotate(0);
    }
  }

  &:hover {
    color: var(--color-primary-dark-300);
    background-color: var(--q-surface-strong);
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-800);
  }
  &:active {
    background-color: var(--color-button-background-active);
    transform: scale(.97);
  }
}

.popup {
  position: absolute;
  top: 100%;
  margin-top: 8px;
  border-radius: 18px;
  box-sizing: border-box;
  background-color: var(--color-content-background);
  background-color: var(--q-menu-bg);
  box-shadow: var(--q-menu-border), var(--q-shadow-float);
  backdrop-filter: blur(var(--q-menu-blur)) saturate(1.7);
  opacity: 0;
  transform: translateY(-6px) scale(.96);
  transform-origin: var(--arrow-left) 0;
  transition: opacity .18s ease, transform .26s cubic-bezier(.22, 1, .36, 1);
  z-index: 20;
  pointer-events: none;
  display: flex;
  overflow: hidden;
}
.list {
  padding: 14px 16px;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  dl {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgb(from var(--color-font) r g b / .07);
  }
  dt { flex: 0 0 100%; }
  dd { min-width: 0; max-width: 100%; margin: 0; }
}

.type {
  padding-bottom: 4px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: .02em;
  color: var(--color-font-label);
}

.tag {
  border: 1px solid transparent;
  color: var(--color-font);
  font: inherit;
  font-size: 12px;
  max-width: 100%;
  overflow-wrap: anywhere;
  display: inline-flex;
  align-items: center;
  margin: 0;
  background-color: rgb(from var(--color-font) r g b / .055);
  padding: 6px 12px;
  border-radius: 999px;
  transition: background-color @transition-fast, color @transition-fast, border-color @transition-fast, transform .14s ease;
  cursor: pointer;
  &:hover {
    color: var(--color-primary-dark-200);
    background-color: var(--color-primary-alpha-900);
  }
  &:active {
    background-color: var(--color-primary-alpha-800);
    transform: scale(.96);
  }
  &.selected {
    border-color: var(--color-primary-alpha-600);
    color: var(--color-primary-dark-200);
    font-weight: 600;
    background-color: var(--color-primary-alpha-900);
  }
}

.label:focus-visible, .tag:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .label, .label .icon svg, .popup, .tag { transition: none; }
}

</style>
