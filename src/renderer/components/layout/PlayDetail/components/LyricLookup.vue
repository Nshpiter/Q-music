<template>
  <material-modal :show="visible" :heading="$t('lyric_dictionary')" width="400px" max-width="90%" bg-close @close="close">
    <section :class="$style.results">
      <p v-if="status" role="status">{{ $t(status) }}</p>
      <article v-for="item in entries" :key="item.dict + ':' + item.n">
        <strong>{{ item.term }}</strong> <span>{{ item.reading }}</span>
        <DictionaryGlossary v-if="item.structured" :parts="item.structured" :dict="item.dict" />
        <p v-else>{{ item.meaning }}</p>
        <small>{{ item.dict }}</small>
        <button type="button" :disabled="saving || saved.includes(item)" @click="save(item)">{{ $t(saved.includes(item) ? 'dict_card_done' : 'dict_card') }}</button>
      </article>
    </section>
  </material-modal>
</template>
<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { dictionaryRequest, addAnkiCard } from '@renderer/utils/lyricDictionary'
import DictionaryGlossary from './DictionaryGlossary.vue'
const visible = ref(false)
const status = ref('')
const entries = shallowRef([])
const saved = shallowRef([])
const saving = ref(false)
let revision = 0
const close = () => { revision++; visible.value = false }
const textOf = range => {
  const fragment = range.cloneContents()
  for (const rt of fragment.querySelectorAll('rt')) rt.remove()
  return fragment.textContent.trim().slice(0, 64)
}
const lookup = async(text, reading) => {
  const id = ++revision
  visible.value = true
  entries.value = saved.value = []
  saving.value = false
  status.value = 'dict_searching'
  try {
    const list = await dictionaryRequest('lookup', text)
    if (revision !== id) return
    entries.value = list.map(item => item.term === text && reading ? { ...item, reading } : item)
    status.value = list.length ? '' : 'dict_no_match'
  } catch { if (revision === id) status.value = 'dict_failed' }
}
let selection = null
const cancelSelection = () => {
  if (selection) window.getSelection()?.removeAllRanges()
  selection = null
}
const point = event => document.caretRangeFromPoint(event.clientX, event.clientY)
const start = event => {
  if (event.button !== 0 || !event.shiftKey) return
  const row = event.target.closest('.lyric .font-lrc, .lyricSelectContent span')
  const anchor = point(event)
  if (!row || !anchor || !row.contains(anchor.startContainer)) return
  cancelSelection()
  selection = { row, anchor, range: anchor.cloneRange(), ruby: event.target.closest('ruby') }
  event.preventDefault()
  event.stopPropagation()
}
const move = event => {
  if (!selection) return
  const end = point(event)
  const { anchor, row } = selection
  if (!end || !row.contains(end.startContainer)) return
  const reverse = anchor.compareBoundaryPoints(window.Range.START_TO_START, end) > 0
  const range = (reverse ? end : anchor).cloneRange()
  const last = reverse ? anchor : end
  range.setEnd(last.startContainer, last.startOffset)
  selection.range = range
  const highlight = window.getSelection()
  highlight.removeAllRanges()
  highlight.addRange(range)
}
const finish = event => {
  if (!selection || (event.type === 'keyup' && event.key !== 'Shift')) return
  const { range, row, ruby } = selection
  const selected = !range.collapsed
  if (!selected) range.setEnd(row, row.childNodes.length)
  const text = textOf(range)
  const reading = ruby?.querySelector('rt')?.textContent
  cancelSelection()
  if (text) void lookup(text, reading)
}
const save = async(item) => {
  const id = revision
  saving.value = true
  try {
    await addAnkiCard(item)
    if (id === revision) { saved.value = [...saved.value, item]; status.value = '' }
  } catch { if (id === revision) status.value = 'dict_anki_error' } finally { if (id === revision) saving.value = false }
}
onMounted(() => {
  document.addEventListener('mousedown', start, true)
  document.addEventListener('mousemove', move, true)
  document.addEventListener('mouseup', finish, true)
  document.addEventListener('keyup', finish, true)
  window.addEventListener('blur', cancelSelection)
})
onBeforeUnmount(() => {
  close()
  cancelSelection()
  document.removeEventListener('mousedown', start, true)
  document.removeEventListener('mousemove', move, true)
  document.removeEventListener('mouseup', finish, true)
  document.removeEventListener('keyup', finish, true)
  window.removeEventListener('blur', cancelSelection)
})
</script>
<style module>
.results { overflow-y: auto; max-height: 60vh; padding: 2px 20px 16px; }
.results article { padding: 10px 0; border-bottom: 1px solid var(--q-outline); }
.results p { white-space: pre-line; margin: 5px 0; }
.results small, .results span { color: var(--color-font-label); }
.results button { margin-inline-start: 12px; color: var(--color-primary); }
</style>
