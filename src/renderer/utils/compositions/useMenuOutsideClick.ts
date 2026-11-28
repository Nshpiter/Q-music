import { onBeforeUnmount, onMounted, type Ref } from '@common/utils/vueTools'

export default (panel: Ref<HTMLElement | null>, getTrigger: () => HTMLElement | null | undefined, close: () => void) => {
  const handleClick = (event: MouseEvent) => {
    if (!panel.value) return
    const path = event.composedPath()
    const trigger = getTrigger()
    if (path.includes(panel.value) || (trigger && path.includes(trigger))) return
    close()
  }
  // 播放栏按钮会阻止冒泡。捕获阶段先收起旧菜单，触发按钮本身仍可切换开关。
  onMounted(() => { document.addEventListener('click', handleClick, true) })
  onBeforeUnmount(() => { document.removeEventListener('click', handleClick, true) })
}
