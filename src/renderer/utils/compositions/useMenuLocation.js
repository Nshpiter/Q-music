import { onMounted, onBeforeUnmount, watch, reactive, ref } from '@common/utils/vueTools'


export default ({ visible, location, onHide }) => {
  const transition1 = 'transform, opacity'
  const transition2 = 'transform, opacity, top, left'
  let show = false
  let lastOffset = '0px, 0px'
  const dom_menu = ref(null)
  const menuStyles = reactive({
    left: 0,
    top: 0,
    opacity: 0,
    transitionProperty: 'transform, opacity',
    transform: 'scale(.92) translate(0px, -4px)',
    pointerEvents: 'none',
  })

  const handleShow = () => {
    show = true
    lastOffset = handleGetOffsetXY(location.value.x, location.value.y)
    menuStyles.opacity = 1
    menuStyles.transform = `scale(1) translate(${lastOffset})`
    menuStyles.pointerEvents = 'auto'
  }
  const handleHide = () => {
    menuStyles.opacity = 0
    menuStyles.transform = `scale(.95) translate(${lastOffset})`
    menuStyles.pointerEvents = 'none'
    show = false
  }
  const handleGetOffsetXY = (left, top) => {
    const listWidth = dom_menu.value.clientWidth
    const listHeight = dom_menu.value.clientHeight
    const dom_container_parant = dom_menu.value.offsetParent
    const containerWidth = dom_container_parant.clientWidth
    const containerHeight = dom_container_parant.clientHeight
    const offsetWidth = containerWidth - left - listWidth
    const offsetHeight = containerHeight - top - listHeight
    let x = 0
    let y = 0
    if (containerWidth > listWidth && offsetWidth < 12) {
      x = offsetWidth - 12
    }
    if (containerHeight > listHeight && offsetHeight < 5) {
      y = offsetHeight - 5
    }
    return `${x}px, ${y}px`
  }
  const handleDocumentClick = (event) => {
    if (!show) return

    if (dom_menu.value?.contains(event.target)) return

    if (show && menuStyles.transitionProperty != transition1) menuStyles.transitionProperty = transition1

    onHide()
  }

  watch(visible, visible => {
    visible ? handleShow() : handleHide()
  }, { immediate: true })

  watch(location, location => {
    menuStyles.left = location.x - window.lx.rootOffset + 2 + 'px'
    menuStyles.top = location.y - window.lx.rootOffset + 'px'
    // nextTick(() => {
    if (show) {
      if (menuStyles.transitionProperty != transition2) menuStyles.transitionProperty = transition2
      lastOffset = handleGetOffsetXY(location.x, location.y)
      menuStyles.transform = `scale(1) translate(${lastOffset})`
    }
    // })
  }, { deep: true })

  onMounted(() => {
    // 捕获阶段关闭，播放详情等入口即使阻止冒泡也能正确收起菜单。
    document.addEventListener('pointerdown', handleDocumentClick, true)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', handleDocumentClick, true)
  })

  return {
    dom_menu,
    menuStyles,
  }
}
