import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { pickrTools, type PickrTools } from '@renderer/utils/pickrTools'

export default (swatches: string[] | null = null) => {
  const colorRef = ref<HTMLElement | null>(null)
  let tools: PickrTools | null = null

  const destroy = () => {
    tools?.destroy()
    tools = null
  }
  const init = (color: string, changed: (color: string) => void, reset?: () => void) => {
    if (!colorRef.value) return
    destroy()
    tools = pickrTools.create(colorRef.value, color, swatches, changed, reset)
  }
  const setColor = (color: string) => {
    tools?.setColor(color)
  }

  onBeforeUnmount(destroy)

  return { colorRef, init, destroy, setColor }
}
