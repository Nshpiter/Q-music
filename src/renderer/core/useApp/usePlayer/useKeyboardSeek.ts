import { onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting, setTogglePlayMode } from '@renderer/store/setting'
import { isFullscreen } from '@renderer/store'
import { volume } from '@renderer/store/player/volume'
import { getCurrentTime, getDuration } from '@renderer/plugins/player'
import { setFullScreen } from '@renderer/utils/ipc'
import { playNext, playPrev } from '@renderer/core/player'

const modes = ['listLoop', 'random', 'list', 'singleLoop', 'none'] as const
export default () => {
  const handle = ({ event, type, key }: LX.KeyDownEevent) => {
    if (!appSetting['player.keyboardSeek'] || type !== 'down' || !event || event.lx_handled === true || event.defaultPrevented || event.isComposing || event.metaKey || window.lx.isEditingHotKey) return
    if ((event.target as HTMLElement)?.closest?.('input, textarea, select, button, a, [contenteditable], [role="dialog"], [role="slider"], [role="tablist"], [role="menu"], [role="listbox"]')) return
    const local = window.lx.appHotKeyConfig.local
    if (local.enable && local.keys[key]) return
    const code = event.code
    const step = event.shiftKey ? 20 : event.ctrlKey ? 5 : event.altKey ? 1 : 10
    if (step != 10 && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyJ', 'KeyL'].includes(code)) return
    const seconds = getDuration()
    const digit = /^(?:Digit|Numpad)(\d)$/.exec(code)
    const seek = (time: number) => {
      if (seconds > 0 && Number.isFinite(seconds)) window.app_event.setProgress(Math.min(seconds, Math.max(0, time)))
    }
    if (digit) seek(seconds * Number(digit[1]) / 10)
    else {
      switch (code) {
        case 'ArrowLeft': case 'KeyJ': seek(getCurrentTime() - step); break
        case 'ArrowRight': case 'KeyL': seek(getCurrentTime() + step); break
        case 'Comma': seek(getCurrentTime() - 1); break
        case 'Period': seek(getCurrentTime() + 1); break
        case 'ArrowUp': window.app_event.setVolume(Math.min(1, volume.value + step / 100)); break
        case 'ArrowDown': window.app_event.setVolume(Math.max(0, volume.value - step / 100)); break
        case 'Equal': case 'NumpadAdd': if (!event.repeat) void playNext(); break
        case 'Minus': case 'NumpadSubtract': if (!event.repeat) void playPrev(); break
        case 'KeyF': if (!event.repeat) void setFullScreen(!isFullscreen.value).then(value => { isFullscreen.value = value }); break
        case 'KeyO': if (!event.repeat) setTogglePlayMode(modes[(modes.indexOf(appSetting['player.togglePlayMethod']) + 1) % modes.length]); break
        default: return
      }
    }
    event.preventDefault()
    event.lx_handled = true
  }
  window.app_event.on('keyDown', handle)
  onBeforeUnmount(() => { window.app_event.off('keyDown', handle) })
}
