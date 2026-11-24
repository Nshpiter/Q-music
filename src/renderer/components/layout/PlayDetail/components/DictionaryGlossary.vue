<script>
import { defineComponent, h } from 'vue'
import ImageEntry from './DictionaryImage.vue'

const tags = new Set('span div b i strong em small sub sup br ruby rt rp ol ul li table thead tbody tr td th details summary'.split(' '))
export default defineComponent({
  props: { dict: { type: String, required: true }, parts: { type: Array, required: true } },
  setup(props) {
    const render = (node, depth = 0) => {
      if (typeof node === 'string') return node
      if (!node || depth > 40 || typeof node !== 'object') return ''
      if (Array.isArray(node)) return node.map(part => render(part, depth + 1))
      if (node.type === 'image' || node.tag === 'img') return h(ImageEntry, { dict: props.dict, path: node.path, alt: node.description || node.title || '' })
      if (node.type === 'text') return String(node.text || '')
      const children = render(node.content, depth + 1)
      if (!tags.has(node.tag)) return children
      return h(node.tag, null, children)
    }
    return () => h('div', { class: 'dictionary-glossary' }, props.parts.map(part => h('div', null, render(part))))
  },
})
</script>
<style>
.dictionary-glossary { margin: 5px 0; white-space: pre-line; overflow-wrap: anywhere; }
.dictionary-glossary ol, .dictionary-glossary ul { padding-inline-start: 1.6em; }
.dictionary-glossary ol { list-style: decimal; }
.dictionary-glossary ul { list-style: disc; }
.dictionary-glossary td, .dictionary-glossary th { padding: .15em .4em; border: 1px solid var(--q-outline); }
</style>
