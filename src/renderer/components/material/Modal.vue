<template>
  <teleport :to="teleport">
    <div v-if="showModal" ref="dom_container" data-modal-container="true" :class="$style.container">
      <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
        <div v-show="showContent" :class="[$style.modal, {[$style.filter]: filter, [$style.viewModal]: isViewModal}]" @click="bgClose && close()">
          <transition :enter-active-class="inClass" :leave-active-class="outClass" @after-enter="$emit('after-enter', $event)" @after-leave="handleAfterLeave">
            <div v-show="showContent" ref="dom_content" :class="$style.content" :style="contentStyle" role="dialog" aria-modal="true" :aria-labelledby="dialogTitleId || undefined" :aria-label="$attrs['aria-label'] || (!dialogTitleId ? 'Q-music' : undefined)" tabindex="-1" @click.stop>
              <header :class="$style.header">
                <button v-if="closeBtn" type="button" :aria-label="$t('close')" @click="close">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 212.982 212.982" space="preserve">
                    <use xlink:href="#icon-delete" />
                  </svg>
                </button>
              </header>
              <slot />
            </div>
          </transition>
        </div>
      </transition>
    </div>
  </teleport>
</template>

<script>
import { getRandom } from '@common/utils/common'
import { nextTick } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'

let modalCount = 0
let modalSeq = 0
// 按目标节点记录正在显示的弹窗实例 id 集合。用 Set 而非计数器，保证多次 add/remove
// 幂等且不会失衡，避免 show-modal 类残留导致视图被持续置灰（看起来空白）。
const modalTargets = new WeakMap()
// 独立于挂载顺序记录打开顺序，嵌套确认框仅让最上层接管键盘。
const activeModals = []
const focusableSelector = 'button, input, select, textarea, a[href], [tabindex], [contenteditable="true"]'
const isFocusable = element => element?.isConnected && !element.matches(':disabled') && !element.closest('[inert], [aria-hidden="true"]') && element.getClientRects().length > 0
export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    closeBtn: {
      type: Boolean,
      default: true,
    },
    bgClose: {
      type: Boolean,
      default: false,
    },
    escClose: {
      type: Boolean,
      default: undefined,
    },
    teleport: {
      type: String,
      default: '#root',
    },
    maxWidth: {
      type: String,
      default: '76%',
    },
    minWidth: {
      type: String,
      default: '280px',
    },
    maxHeight: {
      type: String,
      default: '76%',
    },
    width: {
      type: String,
      default: 'auto',
    },
    height: {
      type: String,
      default: 'auto',
    },
  },
  emits: ['after-enter', 'after-leave', 'close'],
  data() {
    return {
      animates: [
        [['jackInTheBox', 'flipInX', 'flipInY', 'lightSpeedIn'], ['flipOutX', 'flipOutY', 'lightSpeedOut']],
        // [['jackInTheBox', 'lightSpeedIn'], ['lightSpeedOut']],
        [['rotateInDownLeft', 'rotateInDownRight', 'rotateInUpLeft', 'rotateInUpRight'], ['rotateOutDownLeft', 'rotateOutDownRight', 'rotateOutUpLeft', 'rotateOutUpRight']],
        [['jackInTheBox', 'zoomInDown', 'zoomInUp'], ['zoomOutDown', 'zoomOutUp']],
        [['slideInDown', 'slideInLeft', 'slideInRight', 'slideInUp'], ['slideOutDown', 'slideOutLeft', 'slideOutRight', 'slideOutUp']],

        // ['flipInX', 'flipOutX'],
        // ['flipInY', 'flipOutY'],
        // ['lightSpeedIn', 'lightSpeedOut'],
        // ['rotateInDownLeft', 'rotateOutDownLeft'],
        // ['rotateInDownRight', 'rotateOutDownRight'],
        // ['rotateInUpLeft', 'rotateOutUpLeft'],
        // ['rotateInUpRight', 'rotateOutUpRight'],
        // // ['rollIn', 'rollOut'],
        // // ['zoomIn', 'zoomOut'],
        // ['zoomInDown', 'zoomOutDown'],
        // // ['zoomInLeft', 'zoomOutLeft'],
        // // ['zoomInRight', 'zoomOutRight'],
        // ['zoomInUp', 'zoomOutUp'],
        // ['slideInDown', 'slideOutDown'],
        // ['slideInLeft', 'slideOutLeft'],
        // ['slideInRight', 'slideOutRight'],
        // ['slideInUp', 'slideOutUp'],
        // // ['jackInTheBox', 'hinge'],
      ],
      // animateIn: [
      //   'flipInX',
      //   'flipInY',
      //   // 'fadeIn',
      //   // 'bounceIn',
      //   'lightSpeedIn',
      //   'rotateInDownLeft',
      //   'rotateInDownRight',
      //   'rotateInUpLeft',
      //   'rotateInUpRight',
      //   'rollIn',
      //   'zoomIn',
      //   'zoomInDown',
      //   'zoomInLeft',
      //   'zoomInRight',
      //   'zoomInUp',
      //   'slideInDown',
      //   'slideInLeft',
      //   'slideInRight',
      //   'slideInUp',
      //   'jackInTheBox',
      // ],
      // animateOut: [
      //   'flipOutX',
      //   'flipOutY',
      //   // 'fadeOut',
      //   // 'bounceOut',
      //   'lightSpeedOut',
      //   'rotateOutDownLeft',
      //   'rotateOutDownRight',
      //   'rotateOutUpLeft',
      //   'rotateOutUpRight',
      //   'rollOut',
      //   'zoomOut',
      //   'zoomOutDown',
      //   'zoomOutLeft',
      //   'zoomOutRight',
      //   'zoomOutUp',
      //   'slideOutDown',
      //   'slideOutLeft',
      //   'slideOutRight',
      //   'slideOutUp',
      //   'hinge',
      // ],
      inClass: 'animated jackInTheBox',
      outClass: 'animated slideOutRight',
      showModal: false,
      showContent: false,
      modalCount: false,
      isAddedClass: false,
      isCounted: false,
      modalTarget: null,
      modalUid: ++modalSeq,
      showChangeId: 0,
      previousFocus: null,
      dialogTitleId: '',
      // ai: 0,
    }
  },
  computed: {
    contentStyle() {
      return {
        maxWidth: this.maxWidth,
        minWidth: this.minWidth,
        width: this.width,
        height: this.height,
        '--modal-max-height': this.maxHeight,
      }
    },
    filter() {
      return this.teleport == '#root' || this.modalCount > 1
    },
    isViewModal() {
      return this.teleport == '#view'
    },
  },
  watch: {
    show(val) {
      this.handleShowChange(val)
    },
  },
  mounted() {
    document.addEventListener('keydown', this.handleKeydown, true)
    if (this.show) this.handleShowChange(true)
    this.setRandomAnimation()
  },
  beforeUnmount() {
    this.showChangeId++
    document.removeEventListener('keydown', this.handleKeydown, true)
    this.deactivateModal()
    this.removeModalCount()
    this.removeClass()
  },
  methods: {
    handleShowChange(val) {
      const showChangeId = ++this.showChangeId
      if (val) {
        // const dom = document.getElementById(this.teleport)
        // if (dom) {
        //   // dom.t
        // }
        this.setRandomAnimation()
        if (!activeModals.includes(this)) {
          // 快速重开时焦点可能尚未离开内容，保留最初的外部入口。
          if (!this.$refs.dom_content?.contains(document.activeElement)) this.previousFocus = document.activeElement
          activeModals.push(this)
        }
        if (!this.isCounted) {
          this.modalCount = ++modalCount
          this.isCounted = true
        }
        this.showModal = true
        void nextTick(() => {
          if (showChangeId !== this.showChangeId || !this.show) return
          if (!this.$refs.dom_container) return
          const node = this.$refs.dom_container.parentNode
          this.addClass(node)
          this.showContent = true
          void nextTick(() => {
            if (showChangeId === this.showChangeId) this.focusContent()
          })
        })
      } else {
        this.deactivateModal()
        this.removeModalCount()
        this.removeClass()
        this.showContent = false
      }
    },
    deactivateModal() {
      const index = activeModals.indexOf(this)
      if (index < 0) return
      const wasTop = index == activeModals.length - 1
      activeModals.splice(index, 1)
      for (const modal of activeModals) {
        if (this.$refs.dom_content?.contains(modal.previousFocus)) modal.previousFocus = this.previousFocus
      }
      if (!wasTop) return
      const showChangeId = this.showChangeId
      const previousFocus = this.previousFocus
      void nextTick(() => {
        if (showChangeId !== this.showChangeId || activeModals.includes(this)) return
        const top = activeModals.at(-1)
        if (top) {
          if (top.$refs.dom_content?.contains(previousFocus) && isFocusable(previousFocus)) previousFocus.focus({ preventScroll: true })
          else top.focusContent()
        } else if (isFocusable(previousFocus) && !previousFocus.closest('[data-modal-container]')) {
          previousFocus.focus({ preventScroll: true })
        }
      })
    },
    getFocusableElements() {
      return Array.from(this.$refs.dom_content?.querySelectorAll(focusableSelector) ?? []).filter(element => element.tabIndex >= 0 && isFocusable(element))
    },
    focusContent() {
      if (!this.show || !this.showContent || activeModals.at(-1) !== this) return
      const content = this.$refs.dom_content
      if (!content) return
      const heading = content.querySelector('h1, h2, [role="heading"]')
      if (heading && !heading.id) heading.id = `modal-title-${this.modalUid}`
      this.dialogTitleId = heading?.id ?? ''
      if (content.contains(document.activeElement)) return
      const items = this.getFocusableElements()
      const target = items.find(element => element.hasAttribute('autofocus')) ?? items[0] ?? content
      target.focus({ preventScroll: true })
    },
    handleKeydown(event) {
      if (event.lx_handled || !this.show || activeModals.at(-1) !== this || !['Escape', 'Tab'].includes(event.key)) return
      const content = this.$refs.dom_content
      // 弹窗内部打开的独立菜单自行处理 Escape 和方向键。
      if (!content?.contains(event.target) && event.target.closest?.('[role="menu"], [role="listbox"]')) return
      if (event.key == 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.lx_handled = true
        if (!event.repeat && (this.escClose ?? (this.closeBtn || this.bgClose))) this.close()
        return
      }
      const items = this.getFocusableElements()
      const current = items.indexOf(document.activeElement)
      if (items.length && current >= 0 && (event.shiftKey ? current > 0 : current < items.length - 1)) return
      event.preventDefault()
      event.stopPropagation()
      const target = event.shiftKey ? items.at(-1) : items[0]
      ;(target ?? content)?.focus({ preventScroll: true })
    },
    addClass(node) {
      if (!node) return
      if (this.modalTarget && this.modalTarget !== node) this.removeClass()
      let set = modalTargets.get(node)
      if (!set) {
        set = new Set()
        modalTargets.set(node, set)
      }
      set.add(this.modalUid)
      node.classList.add('show-modal')
      this.modalTarget = node
      this.isAddedClass = true
    },
    removeModalCount() {
      if (!this.isCounted) return
      if (modalCount > 0) modalCount--
      this.modalCount = modalCount
      this.isCounted = false
    },
    removeClass() {
      if (!this.isAddedClass) return
      const node = this.modalTarget || this.$refs.dom_container?.parentNode
      this.modalTarget = null
      this.isAddedClass = false
      if (!node) return
      const set = modalTargets.get(node)
      if (set) {
        set.delete(this.modalUid)
        if (set.size) return
        modalTargets.delete(node)
      }
      node.classList.remove('show-modal')
    },
    setRandomAnimation() {
      if (appSetting['common.randomAnimate']) {
        const [animIn, animOut] = this.animates[getRandom(0, this.animates.length)]
        // const [animIn, animOut] = this.animates[this.ai]
        // if (++this.ai >= this.animates.length) this.ai = 0
        // console.log(animIn, animOut)
        // this.inClass = 'animated ' + animIn
        // this.outClass = 'animated ' + animOut
        this.inClass = 'animated ' + animIn[getRandom(0, animIn.length)]
        this.outClass = 'animated ' + animOut[getRandom(0, animOut.length)]
      }
    },
    close() {
      this.$emit('close')
    },
    handleAfterLeave(event) {
      if (this.show || this.showContent) return
      this.$emit('after-leave', event)
      this.showModal = false
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99;
}

.modal {
  width: 100%;
  height: 100%;
  // background-color: rgba(0, 0, 0, .2);
  // background-color: rgba(255, 255, 255, .6);
  // background-color: var(--color-primary-light-600-alpha-900);
  // backdrop-filter: blur(4px);
  // backdrop-filter: grayscale(70%);
  display: grid;
  align-items: center;
  justify-items: center;
  box-sizing: border-box;
  // will-change: transform;

  &.viewModal {
    padding-bottom: @height-player;
  }

  &.filter {
    background: rgba(255, 255, 255, .22);
    backdrop-filter: blur(14px) saturate(1.08);
  }

  // &:before {
  //   .mixin-after();
  //   position: absolute;
  //   left: 0;
  //   top: 0;
  //   width: 100%;
  //   height: 100%;
  //   background-color: var(--color-000);
  //   opacity: .6;
  // }
}

.content {
  position: relative;
  border-radius: 22px;
  box-shadow: var(--q-shadow-float);
  overflow: hidden;
  max-height: var(--modal-max-height);
  // max-width: 76%;
  min-width: 220px;
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  z-index: 100;
  background: rgba(255, 255, 255, .86);
  backdrop-filter: blur(18px);
}

.viewModal {
  .content {
    max-height: min(var(--modal-max-height), calc(100% - @height-player - 24px));
  }
}

.header {
  flex: none;
  background: rgba(255, 255, 255, .42);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 32px;
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, .58);

  button {
    border: none;
    cursor: pointer;
    width: 30px;
    height: 30px;
    padding: 0;
    margin-right: 4px;
    border-radius: 12px;
    background-color: transparent;
    color: var(--color-primary-dark-500-alpha-500);
    outline: none;
    transition: @transition-fast;
    transition-property: background-color, color, transform;
    line-height: 0;

    svg {
      height: .72em;
    }

    &:hover {
      color: var(--color-primary-dark-300);
      background-color: rgba(255, 255, 255, .7);
      transform: translateY(-1px);
    }
    &:active {
      background-color: var(--color-primary-dark-200-alpha-600);
      transform: scale(.96);
    }
  }
}

// 弹窗在沉浸播放页内沿用同一组深色材质与交互层级；离开详情页后仍使用原主题。
:global(body:has(#container.show-player-detail)) .modal {
  color: rgba(255, 255, 255, .9);

  &.filter {
    background: rgba(9, 13, 16, .36);
    backdrop-filter: blur(18px) saturate(.92);
  }
}

:global(body:has(#container.show-player-detail)) .content {
  color: rgba(255, 255, 255, .9);
  border: 1px solid rgba(255, 255, 255, .12);
  background: rgba(25, 30, 34, .9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 28px 70px rgba(0, 0, 0, .42);
  backdrop-filter: blur(28px) saturate(1.12);
}

:global(body:has(#container.show-player-detail)) .header {
  background: rgba(255, 255, 255, .035);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, .08);

  button {
    color: rgba(255, 255, 255, .62);

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, .1);
    }
  }
}

</style>
