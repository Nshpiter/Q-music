<template>
  <div v-if="dragging && !visible" :class="$style.dropHint" role="status">{{ $t('local_import_drop_window') }}</div>
  <material-modal :show="visible" :heading="$t('local_import_title')" :bg-close="!busy" :close-btn="!busy" width="480px" teleport="#root" @close="close">
    <main class="scroll" :class="$style.main" :aria-busy="busy">
      <div :class="[$style.dropZone, { [$style.dragging]: dragging }]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 8V6a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m-3-3 3 3 3-3" /></svg>
        <strong>{{ $t('local_import_description') }}</strong>
        <div :class="$style.actions">
          <base-btn :disabled="busy" @click="select(false)">{{ $t('local_import_files') }}</base-btn>
          <base-btn :disabled="busy" @click="select(true)">{{ $t('local_import_folder') }}</base-btn>
        </div>
      </div>
      <div :class="$style.options">
        <base-checkbox id="local-import-recursive" v-model="recursive" :disabled="busy" :label="$t('local_import_recursive')" />
        <base-checkbox id="local-import-group" v-model="byFolder" :disabled="busy" :label="$t('local_import_by_folder')" />
      </div>
      <p>{{ $t('local_import_target', { name: targetName }) }}</p>
      <p :class="$style.hint">{{ $t('local_import_hint') }}</p>
      <div v-if="message" :class="$style.status">
        <p role="status">{{ message }}</p>
        <base-btn v-if="firstListId && !busy" min @click="openList">{{ $t('local_import_open') }}</base-btn>
      </div>
    </main>
  </material-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { webUtils } from 'electron'
import { extname } from 'node:path'
import { userLists, isShowLocalMusicModal as visible } from '@renderer/store/list/state'
import { setShowPlayerDetail, setShowPlayQueue } from '@renderer/store/player/action'
import { showSelectDialog } from '@renderer/utils/ipc'
import { useI18n } from '@renderer/plugins/i18n'
import { localAudioExtensions } from '@common/utils/localMusicFiles'
import { importLocalMusicFiles } from '../actions'

const router = useRouter()
const t = useI18n()
const busy = ref(false)
const dragging = ref(false)
const recursive = ref(true)
const byFolder = ref(true)
const message = ref('')
const firstListId = ref('')
const targetName = computed(() => userLists.find(item => item.id == 'local_music')?.name ?? t('local_import_title'))
const close = () => {
  if (busy.value) return
  dragging.value = false
  visible.value = false
}
const openList = async() => {
  await router.push({ path: '/list', query: { id: firstListId.value } })
  setShowPlayerDetail(false)
  setShowPlayQueue(false)
  close()
}
interface Selection { files: string[], folders: string[] }
const runImport = async(getSelection: () => Selection | Promise<Selection | undefined>) => {
  if (busy.value) return
  busy.value = true
  try {
    const selection = await getSelection()
    if (!selection) return
    firstListId.value = ''
    message.value = t('local_import_scanning')
    const scanned = selection.folders.length
      ? await window.lx.worker.main.scanLocalMusicFolders(selection.folders, recursive.value)
      : { files: [], unreadableFolders: 0 }
    const audio = selection.files.filter(file => localAudioExtensions.includes(extname(file).slice(1).toLowerCase()))
    const paths = audio.concat(scanned.files)
    if (!paths.length) {
      message.value = t('local_import_empty')
    } else {
      const imported = await importLocalMusicFiles(paths, {
        folderFiles: byFolder.value ? new Set(scanned.files) : undefined,
        onProgress: (current, total) => { message.value = t('local_import_progress', { current, total }) },
      })
      message.value = t('local_import_result', { added: imported.added, duplicates: imported.duplicates, skipped: imported.skipped })
      firstListId.value = imported.firstListId ?? ''
    }
    if (scanned.unreadableFolders) message.value += ` ${t('local_import_unreadable', { count: scanned.unreadableFolders })}`
    const unsupported = selection.files.length - audio.length
    if (unsupported) message.value += ` ${t('local_import_unsupported', { count: unsupported })}`
  } catch {
    firstListId.value = ''
    message.value = t('local_import_failed')
  } finally { busy.value = false }
}
const select = async(folder: boolean) => runImport(async() => {
  const result = await showSelectDialog({
    title: t(folder ? 'local_import_folder' : 'local_import_files'),
    properties: folder ? ['openDirectory', 'multiSelections'] : ['openFile', 'multiSelections'],
    ...(folder ? {} : { filters: [{ name: 'Audio', extensions: localAudioExtensions }] }),
  })
  if (result.canceled || !result.filePaths.length) return
  return folder ? { folders: result.filePaths, files: [] } : { files: result.filePaths, folders: [] }
})
const resetDrag = () => { dragging.value = false }
const handleFileDrag = (event: DragEvent) => {
  const transfer = event.dataTransfer
  if (!transfer?.types.includes('Files')) return
  if (event.target instanceof Element && event.target.closest('input[type="file"]')) {
    resetDrag()
    return
  }
  event.preventDefault()
  event.stopPropagation()
  transfer.dropEffect = busy.value ? 'none' : 'copy'
  dragging.value = !busy.value && event.type !== 'drop'
  if (busy.value || event.type !== 'drop') return

  // 系统只在 drop 回调期间开放 File 和目录条目，异步扫描前先取出路径。
  const selection: Selection = { files: [], folders: [] }
  for (const item of Array.from(transfer.items)) {
    const file = item.getAsFile()
    const path = file && webUtils.getPathForFile(file)
    if (!path) continue
    if (item.webkitGetAsEntry()?.isDirectory) selection.folders.push(path)
    else selection.files.push(path)
  }
  if (!selection.files.length && !selection.folders.length) return
  visible.value = true
  void runImport(() => selection)
}
const dragLeave = (event: DragEvent) => {
  if (!event.relatedTarget) resetDrag()
}
onMounted(() => {
  window.addEventListener('dragenter', handleFileDrag, true)
  window.addEventListener('dragover', handleFileDrag, true)
  window.addEventListener('drop', handleFileDrag, true)
  window.addEventListener('dragleave', dragLeave, true)
  window.addEventListener('dragend', resetDrag, true)
  window.addEventListener('blur', resetDrag)
})
onBeforeUnmount(() => {
  window.removeEventListener('dragenter', handleFileDrag, true)
  window.removeEventListener('dragover', handleFileDrag, true)
  window.removeEventListener('drop', handleFileDrag, true)
  window.removeEventListener('dragleave', dragLeave, true)
  window.removeEventListener('dragend', resetDrag, true)
  window.removeEventListener('blur', resetDrag)
})
</script>

<style lang="less" module>
.dropHint {
  position: fixed; z-index: 200; inset: auto 0 20px; width: fit-content; margin-inline: auto;
  padding: 9px 16px; border: 1px solid var(--color-primary); border-radius: 12px;
  color: var(--color-font); background: var(--color-content-background); pointer-events: none;
}
.main {
  min-height: 0;
  overflow-y: auto;
  flex: 1;
  padding: 0 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--color-font);
  > * { flex-shrink: 0; }
  p { margin: 0; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
}
.dropZone {
  display: grid; justify-items: center; gap: 9px; padding: 16px 10px;
  text-align: center; border: 1px dashed var(--q-outline); border-radius: 14px;
  background: var(--q-surface-soft);
  svg { width: 28px; height: 28px; color: var(--color-primary); }
  strong { font-size: 14px; font-weight: 600; }
  &.dragging { border-color: var(--color-primary); background: rgb(from var(--color-primary) r g b / .12); }
}
.actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.options { display: flex; flex-wrap: wrap; gap: 10px 18px; }
.hint { color: var(--color-font-label); }
.status { padding-top: 12px; border-top: 1px solid var(--q-outline); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
</style>
