import { log } from '@common/utils'

type DebugExtra = Record<string, unknown>

const getNodeState = (id: string) => {
  const node = document.getElementById(id)
  if (!node) return null
  const rect = node.getBoundingClientRect()
  const style = window.getComputedStyle(node)

  return {
    className: node.className,
    childCount: node.children.length,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    display: style.display,
    opacity: style.opacity,
    visibility: style.visibility,
    overflow: style.overflow,
  }
}

const hasDirectModalContainer = (node: HTMLElement) => {
  return Array.from(node.children)
    .some(child => (child as HTMLElement).dataset?.modalContainer == 'true')
}

export const cleanupStaleModalClass = () => {
  for (const id of ['root', 'view']) {
    const node = document.getElementById(id)
    if (!node || !node.classList.contains('show-modal')) continue
    if (hasDirectModalContainer(node)) continue
    node.classList.remove('show-modal')
    log.info(`[renderer-debug] cleanup stale show-modal: ${id}`)
  }
}

export const logRendererState = (label: string, extra: DebugExtra = {}) => {
  try {
    log.info('[renderer-debug]', label, JSON.stringify({
      route: window.location.hash,
      root: getNodeState('root'),
      container: getNodeState('container'),
      right: getNodeState('right'),
      view: getNodeState('view'),
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className,
      ...extra,
    }))
  } catch (error) {
    log.error('[renderer-debug] log failed', error)
  }
}
