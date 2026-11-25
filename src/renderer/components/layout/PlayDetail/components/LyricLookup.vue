<template>
  <material-modal :show="visible" :heading="$t('lyric_dictionary')" width="420px" max-width="90%" bg-close @close="close">
    <section class="scroll" :class="$style.results">
      <p v-if="status" :class="$style.status" role="status">{{ $t(status) }}</p>
      <article v-for="item in entries" :key="item.dict + ':' + item.n" :class="$style.entry">
        <div :class="$style.entryHead">
          <div :class="$style.headword">
            <strong>{{ item.term }}</strong>
            <span v-if="item.reading" :class="$style.reading">{{ item.reading }}</span>
          </div>
          <span :class="$style.dictTag">{{ item.dict }}</span>
        </div>
        <DictionaryGlossary v-if="item.structured" :parts="item.structured" :dict="item.dict" />
        <p v-else :class="$style.meaning">{{ item.meaning }}</p>
        <div :class="$style.entryFoot">
          <button type="button" :class="$style.ankiBtn" :disabled="saving || saved.includes(item)" @click="save(item)">{{ $t(saved.includes(item) ? 'dict_card_done' : 'dict_card') }}</button>
        </div>
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
.results { overflow-y: auto; max-height: 60vh; padding: 4px 20px 18px; display: grid; gap: 10px; }
.status { margin: 4px 0; font-size: 13px; color: var(--color-font-label); }
.entry {
  display: grid; gap: 8px; padding: 12px 14px; border-radius: 12px;
  background: var(--q-surface); border: 1px solid var(--q-outline);
}
.entryHead { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.headword { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.headword strong { font-size: 15px; font-weight: 650; }
.reading { font-size: 12.5px; color: var(--color-font-label); }
.dictTag {
  flex: none; padding: 2px 7px; border-radius: 999px; font-size: 11px;
  color: var(--color-font-label); background: rgb(from var(--color-font) r g b / .07);
}
.meaning { white-space: pre-line; margin: 0; font-size: 13px; line-height: 1.55; }
.entryFoot { display: flex; justify-content: flex-end; }
.ankiBtn {
  font: inherit; font-size: 12px; font-weight: 550; cursor: pointer;
  padding: 4px 10px; border-radius: 8px; border: 1px solid var(--q-outline);
  color: var(--color-primary); background: var(--q-surface-strong);
  transition: background-color .18s ease, border-color .18s ease;
}
.ankiBtn:hover:not(:disabled) { border-color: var(--color-primary-alpha-600); background: var(--color-primary-alpha-900); }
.ankiBtn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.ankiBtn:disabled { opacity: .5; cursor: default; }
</style>
