import { ref, watch } from '@common/utils/vueTools'

interface Snippet {
  id: string
  name: string
  css: string
  enabled: boolean
}

const storageKey = 'q-music.style-snippets'
const readSnippets = (): Snippet[] => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(saved)) return []
    return saved.filter(item => item && typeof item.id == 'string' && typeof item.name == 'string' &&
      typeof item.css == 'string' && typeof item.enabled == 'boolean')
  } catch { return [] }
}

export const snippets = ref(readSnippets())
export const styleSaveFailed = ref(false)
export const choosingComponent = ref(false)
export const addSnippet = (name: string, css = '') => {
  const id = crypto.randomUUID()
  snippets.value.push({ id, name, css, enabled: true })
  return id
}

export const useStyleSnippets = () => {
  watch(choosingComponent, (enabled, _, cleanup) => {
    if (!enabled) return
    const outline = document.createElement('div')
    outline.setAttribute('aria-hidden', 'true')
    outline.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid var(--color-primary);background:var(--color-primary-alpha-100);border-radius:5px;box-sizing:border-box'
    document.body.appendChild(outline)
    const targetOf = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement || event.target instanceof SVGElement)) return null
      return event.target.closest<HTMLElement>('button,a,input,select,summary,[role=button],li,h1,h2,h3') ?? event.target.closest<HTMLElement>('div,p,section,aside')
    }
    const hover = (event: MouseEvent) => {
      const target = targetOf(event)
      if (!target) return
      const { x, y, width, height } = target.getBoundingClientRect()
      Object.assign(outline.style, { left: x + 'px', top: y + 'px', width: width + 'px', height: height + 'px' })
    }
    const select = (event: MouseEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      const target = targetOf(event)
      choosingComponent.value = false
      if (!target || !document.getElementById('root')?.contains(target)) return
      const parts = []
      for (let node: Element | null = target; node; node = node.parentElement) {
        if (node.id) { parts.unshift('#' + CSS.escape(node.id)); break }
        let part = node.localName
        const label = node.getAttribute('aria-label')
        if (label) part += '[aria-label="' + CSS.escape(label) + '"]'
        else if (node.classList.length) part += '.' + CSS.escape(node.classList[0])
        const siblings = Array.from(node.parentElement?.children ?? []).filter(sibling => sibling.matches(part))
        if (siblings.length > 1) part += ':nth-child(' + (Array.from(node.parentElement!.children).indexOf(node) + 1) + ')'
        parts.unshift(part)
      }
      const label = [target.getAttribute('aria-label'), target.getAttribute('title'), target.innerText?.trim()].find(Boolean) ?? target.localName
      addSnippet(label.slice(0, 48), parts.join(' > ') + ' { display: none !important; }')
    }
    window.addEventListener('pointermove', hover, true)
    window.addEventListener('click', select, true)
    cleanup(() => {
      outline.remove()
      window.removeEventListener('pointermove', hover, true)
      window.removeEventListener('click', select, true)
    })
  })
  const sheets = new Map<string, { css: string, sheet: CSSStyleSheet }>()
  const removeSheets = () => {
    const previous = new Set(Array.from(sheets.values(), entry => entry.sheet))
    return document.adoptedStyleSheets.filter(sheet => !previous.has(sheet))
  }
  watch(snippets, items => {
    const active = removeSheets()
    const enabled = new Set<string>()
    for (const item of items) {
      if (!item.enabled) continue
      enabled.add(item.id)
      let entry = sheets.get(item.id)
      if (!entry || entry.css != item.css) {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync(item.css)
        entry = { css: item.css, sheet }
        sheets.set(item.id, entry)
      }
      active.push(entry.sheet)
    }
    document.adoptedStyleSheets = active
    for (const id of sheets.keys()) {
      if (!enabled.has(id)) sheets.delete(id)
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
      styleSaveFailed.value = false
    } catch { styleSaveFailed.value = true }
  }, { deep: true, immediate: true })
  // 即使某个片段意外遮住了设置，也能恢复界面并保留编辑内容。
  const disable = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && choosingComponent.value) {
      event.preventDefault()
      event.stopImmediatePropagation()
      choosingComponent.value = false
      return
    }
    if (event.code === 'KeyH' && event.ctrlKey && event.altKey && event.shiftKey) {
      event.preventDefault()
      choosingComponent.value = !choosingComponent.value
      return
    }
    if (event.code != 'Digit0' || !event.ctrlKey || !event.altKey || !event.shiftKey) return
    event.preventDefault()
    for (const item of snippets.value) item.enabled = false
  }
  window.addEventListener('keydown', disable, true)
  return () => {
    window.removeEventListener('keydown', disable, true)
    document.adoptedStyleSheets = removeSheets()
  }
}
