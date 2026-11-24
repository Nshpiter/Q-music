import { onBeforeUnmount, watch } from '@common/utils/vueTools'

const hasKana = text => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)
const makeRuby = (text, reading) => {
  const ruby = document.createElement('ruby')
  const rt = document.createElement('rt')
  rt.textContent = reading
  if (Array.isArray(text)) ruby.append(...text)
  else ruby.append(text)
  ruby.append(rt)
  return ruby
}

const annotatedWord = ({ text, reading }) => reading ? makeRuby(text, reading) : text

// 音节时间与分词边界可能不同。在二者共有的边界分组，保留动画绑定的每个 span。
function annotateTimed(element, tokens, restore) {
  const spans = [...element.children]
  if (spans.map(span => span.textContent).join('') !== tokens.map(token => token.text).join('')) return
  const result = document.createDocumentFragment()
  let word = 0
  let time = 0
  let wordEnd = 0
  let timeEnd = 0
  while (word < tokens.length && time < spans.length) {
    const firstWord = word
    const firstTime = time
    wordEnd += tokens[word++].text.length
    timeEnd += spans[time++].textContent.length
    while (wordEnd !== timeEnd) {
      if (wordEnd < timeEnd) wordEnd += tokens[word++].text.length
      else timeEnd += spans[time++].textContent.length
    }
    const words = tokens.slice(firstWord, word)
    const group = spans.slice(firstTime, time)
    if (words.some(token => token.reading)) {
      if (group.length === 1 && words.length > 1) {
        restore.set(group[0], [...group[0].childNodes])
        group[0].replaceChildren(...words.map(annotatedWord))
      } else {
        result.append(makeRuby(group, words.map(token => token.reading || token.text).join('')))
        continue
      }
    }
    result.append(...group)
  }
  result.append(...spans.slice(time))
  element.replaceChildren(result)
}

export default function useFurigana(lyric, appSetting, reflow) {
  let worker
  let revision = 0
  const stop = () => {
    worker?.terminate()
    worker = null
  }
  watch([() => lyric.lines, () => appSetting['playDetail.japaneseFont'], () => appSetting['playDetail.furigana'], () => appSetting['playDetail.furiganaReadings']], ([lines, font, enabled, overrides], _, cleanup) => {
    const id = ++revision
    const japanese = lines.some(line => hasKana(line.text)) ? lines.filter(line => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(line.text)) : []
    if (!(font || enabled) || !japanese.length) {
      stop()
      return
    }
    const originals = new Map()
    const timedContents = new Map()
    for (const line of japanese) {
      for (const element of line.dom_line.querySelectorAll('.line > .font-lrc, .line > .shadow')) {
        element.lang = 'ja'
        element.classList.toggle('q-japanese-font', font)
        originals.set(element, [...element.childNodes])
      }
    }
    cleanup(() => {
      ++revision
      for (const [span, children] of timedContents) span.replaceChildren(...children)
      for (const [element, children] of originals) {
        element.removeAttribute('lang')
        element.classList.remove('q-japanese-font')
        element.replaceChildren(...children)
      }
      reflow()
    })
    if (!enabled) { stop(); return }
    worker ??= new window.Worker(new URL('furigana/worker.js', document.baseURI))
    worker.onmessage = ({ data }) => {
      if (id !== revision || data.id !== id || !data.result) return
      japanese.forEach((line, index) => {
        const tokens = data.result[index]
        if (!tokens.some(token => token.reading) || tokens.map(token => token.text).join('') !== line.text) return
        for (const element of line.dom_line.querySelectorAll('.line > .font-lrc, .line > .shadow')) {
          if (!element.childElementCount) element.replaceChildren(...tokens.map(annotatedWord))
          else annotateTimed(element, tokens, timedContents)
        }
      })
      reflow()
    }
    worker.onerror = stop
    worker.postMessage({ id, lines: japanese.map(line => line.text), overrides })
  }, { immediate: true })
  onBeforeUnmount(stop)
}
