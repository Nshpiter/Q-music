<template>
  <teleport :to="teleport">
    <div v-if="showModal" ref="dom_container" data-modal-container="true" :class="$style.container">
      <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
        <div v-show="showContent" :class="[$style.modal, {[$style.filter]: filter, [$style.viewModal]: isViewModal}]" @click="bgClose && close()">
          <transition :enter-active-class="inClass" :leave-active-class="outClass" @after-enter="$emit('after-enter', $event)" @after-leave="handleAfterLeave">
            <div v-show="showContent" :class="$style.content" :style="contentStyle" @click.stop>
              <header :class="$style.header">
                <button v-if="closeBtn" type="button" @click="close">
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
    if (this.show) this.handleShowChange(true)
    this.setRandomAnimation()
  },
  beforeUnmount() {
    this.showChangeId++
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
        })
      } else {
        this.removeModalCount()
        this.removeClass()
        this.showContent = false
      }
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

</style>
