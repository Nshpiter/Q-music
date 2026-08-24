<template>
  <!-- 原始文本会先逐段转义，仅由渲染器生成受控标签。 -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div :class="$style.markdown" @click="handleClick" v-html="html" />
</template>

<script>
import { openUrl } from '@common/utils/electron'

const escapeHtml = text => text
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const inlinePattern = /(`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/gi

const renderInline = (text) => {
  let html = ''
  let offset = 0

  for (const match of text.matchAll(inlinePattern)) {
    html += escapeHtml(text.slice(offset, match.index))
    const token = match[0]

    if (token.startsWith('`')) {
      html += `<code>${escapeHtml(token.slice(1, -1))}</code>`
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i)
      html += link
        ? `<a href="#" data-external-url="${escapeHtml(link[2])}">${escapeHtml(link[1])}</a>`
        : escapeHtml(token)
    } else if (token.startsWith('**') || token.startsWith('__')) {
      html += `<strong>${renderInline(token.slice(2, -2))}</strong>`
    } else {
      html += `<em>${renderInline(token.slice(1, -1))}</em>`
    }
    offset = match.index + token.length
  }

  return html + escapeHtml(text.slice(offset))
}

const isBlockStart = line => /^(?:```|#{1,6}\s+|[-+*]\s+|\d+[.)]\s+|>\s?)/.test(line)

const renderMarkdown = (source) => {
  const lines = String(source ?? '').replaceAll('\r\n', '\n').split('\n')
  const html = []

  for (let index = 0; index < lines.length;) {
    const line = lines[index]
    if (!line.trim()) {
      index++
      continue
    }

    if (line.startsWith('```')) {
      const code = []
      index++
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++])
      if (index < lines.length) index++
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      index++
      continue
    }

    const unordered = line.match(/^[-+*]\s+(.+)$/)
    if (unordered) {
      const items = []
      while (index < lines.length) {
        const item = lines[index].match(/^[-+*]\s+(.+)$/)
        if (!item) break
        items.push(`<li>${renderInline(item[1])}</li>`)
        index++
      }
      html.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    const ordered = line.match(/^\d+[.)]\s+(.+)$/)
    if (ordered) {
      const items = []
      while (index < lines.length) {
        const item = lines[index].match(/^\d+[.)]\s+(.+)$/)
        if (!item) break
        items.push(`<li>${renderInline(item[1])}</li>`)
        index++
      }
      html.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ''))
        index++
      }
      html.push(`<blockquote>${renderInline(quote.join(' '))}</blockquote>`)
      continue
    }

    const paragraph = [line.trim()]
    index++
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim())
      index++
    }
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
  }

  return html.join('')
}

export default {
  props: {
    content: {
      type: String,
      default: '',
    },
  },
  computed: {
    html() {
      return renderMarkdown(this.content)
    },
  },
  methods: {
    handleClick(event) {
      const link = event.target.closest?.('[data-external-url]')
      if (!link) return
      event.preventDefault()
      const url = link.dataset.externalUrl
      if (/^https?:\/\//i.test(url)) void openUrl(url)
    },
  },
}
</script>

<style lang="less" module>
.markdown {
  margin-top: 10px;
  color: var(--color-font);
  line-height: 1.65;
  overflow-wrap: anywhere;

  h1, h2, h3, h4, h5, h6 {
    margin: 14px 0 6px;
    color: var(--color-font);
    font-weight: 700;
    line-height: 1.35;
  }
  h1, h2 { font-size: 16px; }
  h3, h4, h5, h6 { font-size: 14px; }
  p + p, p + ul, p + ol, ul + p, ol + p { margin-top: 8px; }
  ul, ol {
    margin: 6px 0;
    padding-left: 24px;
  }
  ul { list-style: disc; }
  ol { list-style: decimal; }
  li + li { margin-top: 4px; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  code {
    padding: 2px 5px;
    border-radius: 5px;
    background: rgba(127, 127, 127, .12);
    font-family: Consolas, 'SFMono-Regular', monospace;
    font-size: .9em;
  }
  pre {
    margin: 10px 0;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(127, 127, 127, .12);
    overflow-x: auto;
    white-space: pre;

    code {
      padding: 0;
      background: none;
    }
  }
  blockquote {
    margin: 8px 0;
    padding: 4px 12px;
    border-left: 3px solid var(--color-primary);
    color: var(--color-primary-font);
  }
  a {
    color: var(--color-primary);
    text-decoration: underline;
    cursor: pointer;
  }
}
</style>
