import { ref, onMounted, onBeforeUnmount, watch, nextTick } from '@common/utils/vueTools'
import { throttle, formatPlayTime2 } from '@common/utils/common'
import { scrollTo } from '@common/utils/renderer'
import { play } from '@renderer/core/player/action'
import { appSetting } from '@renderer/store/setting'
// import { player as eventPlayerNames } from '@renderer/event/names'

export default ({ isPlay, lyric, playProgress, isShowLyricProgressSetting, isShowPlayComment, offset }) => {
  const dom_lyric = ref(null)
  const dom_lyric_text = ref(null)
  const dom_skip_line = ref(null)
  const isMsDown = ref(false)
  const isStopScroll = ref(false)
  const timeStr = ref('--/--')
  const linePlayVisible = ref(false)
  const linePlayTop = ref(0)
  const linePlayTimeStr = ref('--:--')

  let msDownY = 0
  let msDownScrollY = 0
  let timeout = null
  let cancelScrollFn
  let dom_lines
  let isSetedLines = false
  let point = {
    x: null,
    y: null,
  }
  let time = -1
  let linePlayTime = -1
  let dom_pre_line = null
  let isSkipMouseEnter = false
  let linePlayRetryTimer = null
  let clearLinePlayRetry = () => {}

  const getPlayTime = lineIndex => {
    const line = lyric.lines[lineIndex]
    if (!line) return -1
    let nextTime = Math.max(line.time - lyric.offset - lyric.tempOffset, 0) / 1000
    if (playProgress.maxPlayTime && nextTime > playProgress.maxPlayTime) nextTime = playProgress.maxPlayTime
    return nextTime
  }

  const hideLinePlay = () => {
    linePlayVisible.value = false
    linePlayTime = -1
  }

  const handleLinePlayMouseEnter = () => {
    clearLyricScrollTimeout()
  }

  const handleLinePlayMouseLeave = () => {
    startLyricScrollTimeout()
  }

  const setLinePlayProgress = targetTime => {
    clearLinePlayRetry()
    let applied = false
    const applyProgress = () => {
      if (applied) return
      applied = true
      clearLinePlayRetry()
      window.app_event.setProgress(targetTime)
    }
    clearLinePlayRetry = () => {
      window.app_event.off('playerLoadeddata', applyProgress)
      window.app_event.off('playerPlaying', applyProgress)
      if (linePlayRetryTimer) {
        clearTimeout(linePlayRetryTimer)
        linePlayRetryTimer = null
      }
      clearLinePlayRetry = () => {}
    }

    window.app_event.on('playerLoadeddata', applyProgress)
    window.app_event.on('playerPlaying', applyProgress)
    linePlayRetryTimer = setTimeout(applyProgress, 600)
    window.app_event.setProgress(targetTime)
  }

  const handleLinePlay = () => {
    if (linePlayTime < 0) return
    const targetTime = linePlayTime
    hideLinePlay()
    isStopScroll.value = false
    setLinePlayProgress(targetTime)
    if (!isPlay.value) play()
  }

  const handleSkipPlay = () => {
    if (time == -1) return
    handleSkipMouseLeave()
    hideLinePlay()
    isStopScroll.value = false
    window.app_event.setProgress(time)
    if (!isPlay.value) play()
  }
  const handleSkipMouseEnter = () => {
    isSkipMouseEnter = true
    clearLyricScrollTimeout()
  }
  const handleSkipMouseLeave = () => {
    isSkipMouseEnter = false
    startLyricScrollTimeout()
  }

  const throttleSetTime = throttle(() => {
    if (!dom_skip_line.value) return
    const rect = dom_skip_line.value.getBoundingClientRect()
    point.x = rect.x
    point.y = rect.y
    let dom = document.elementFromPoint(point.x, point.y)
    if (dom_pre_line === dom) return
    if (dom.tagName == 'SPAN') {
      dom = dom.parentNode.parentNode
    } else if (dom.classList.contains('line')) {
      dom = dom.parentNode
    }
    if (dom.time == null) {
      if (lyric.lines.length) {
        time = dom.classList.contains('pre') ? 0 : lyric.lines[lyric.lines.length - 1].time ?? 0
        time = Math.max(time - lyric.offset - lyric.tempOffset, 0)
        time /= 1000
        if (time > playProgress.maxPlayTime) time = playProgress.maxPlayTime
        timeStr.value = formatPlayTime2(time)
      } else {
        time = -1
        timeStr.value = '--:--'
      }
    } else {
      time = dom.time
      time = Math.max(time - lyric.offset - lyric.tempOffset, 0)
      time /= 1000
      if (time > playProgress.maxPlayTime) time = playProgress.maxPlayTime
      timeStr.value = formatPlayTime2(time)
    }
    dom_pre_line = dom
  })
  const setTime = () => {
    if (isShowLyricProgressSetting.value) throttleSetTime()
  }

  const getLineIndexByPlayTime = (fallbackLine = 0) => {
    if (!playProgress.nowPlayTime || !lyric.lines.length) return Math.min(Math.max(fallbackLine, 0), dom_lines.length - 1)

    const currentTime = playProgress.nowPlayTime * 1000 + lyric.offset + lyric.tempOffset
    let lineIndex = 0
    for (let i = 0; i < lyric.lines.length; i++) {
      if (lyric.lines[i].time > currentTime) break
      lineIndex = i
    }
    return Math.min(Math.max(lineIndex, 0), dom_lines.length - 1)
  }
  const getCurrentLineIndex = () => {
    const currentLine = Number.isFinite(lyric.line) ? lyric.line : -1
    if (currentLine > 0 && currentLine < dom_lines.length) return currentLine
    return getLineIndexByPlayTime(currentLine)
  }
  const stopScrollAnimation = () => {
    if (!cancelScrollFn) return
    cancelScrollFn()
    cancelScrollFn = null
  }
  const getLrcScrollTarget = () => {
    const dom = dom_lyric.value
    if (!dom || !dom_lines?.length) return null
    if (!dom.clientHeight || !dom.scrollHeight) return null
    const maxScrollTop = Math.max(0, dom.scrollHeight - dom.clientHeight)
    const lineIndex = getCurrentLineIndex()
    const dom_p = dom_lines[lineIndex]
    const focusRatio = isShowPlayComment?.value ? 0.1 : 0.38
    const rawTarget = dom_p
      ? dom.scrollTop + dom_p.getBoundingClientRect().top - dom.getBoundingClientRect().top - dom.clientHeight * focusRatio
      : 0
    if (!Number.isFinite(rawTarget)) return 0
    return Math.min(Math.max(rawTarget, 0), maxScrollTop)
  }
  const clampCurrentLrcScroll = () => {
    const dom = dom_lyric.value
    if (!dom) return
    const maxScrollTop = Math.max(0, dom.scrollHeight - dom.clientHeight)
    if (dom.scrollTop > maxScrollTop) dom.scrollTop = maxScrollTop
    else if (dom.scrollTop < 0) dom.scrollTop = 0
  }

  const handleScrollLrc = (duration = 300, force = false) => {
    if (!dom_lines?.length || !dom_lyric.value) return
    const target = getLrcScrollTarget()
    if (target == null) return
    stopScrollAnimation()
    clampCurrentLrcScroll()
    if (isSkipMouseEnter && !force) return
    if (force) {
      isStopScroll.value = false
      hideLinePlay()
    } else if (isStopScroll.value) {
      return
    }
    if (duration <= 0) {
      dom_lyric.value.scrollTop = target
      return
    }
    cancelScrollFn = scrollTo(dom_lyric.value, target, duration, () => {
      cancelScrollFn = null
    })
  }
  const clearLyricScrollTimeout = () => {
    if (!timeout) return
    clearTimeout(timeout)
    timeout = null
  }
  const startLyricScrollTimeout = () => {
    clearLyricScrollTimeout()
    if (isSkipMouseEnter) return
    timeout = setTimeout(() => {
      timeout = null
      isStopScroll.value = false
      hideLinePlay()
      if (!isPlay.value) return
      handleScrollLrc()
    }, 3000)
  }
  const handleLyricDown = (y) => {
    // console.log(event)
    if (delayScrollTimeout) {
      clearTimeout(delayScrollTimeout)
      delayScrollTimeout = null
    }
    isMsDown.value = true
    msDownY = y
    msDownScrollY = dom_lyric.value.scrollTop
  }
  const handleLyricMouseDown = event => {
    handleLyricDown(event.clientY)
  }
  const handleLyricTouchStart = event => {
    if (event.changedTouches.length) {
      const touch = event.changedTouches[0]
      handleLyricDown(touch.clientY)
    }
  }
  const handleMouseMsUp = event => {
    isMsDown.value = false
  }
  const updateLinePlay = target => {
    if (!isStopScroll.value || isMsDown.value || !dom_lyric.value) return hideLinePlay()
    const line = target?.closest?.('.line-content')
    if (!line || !dom_lyric.value.contains(line)) return hideLinePlay()
    const lineIndex = Number(line.dataset.lineIndex)
    const nextTime = getPlayTime(lineIndex)
    if (nextTime < 0) return hideLinePlay()

    const parentRect = dom_lyric.value.parentElement.getBoundingClientRect()
    const lineRect = line.getBoundingClientRect()
    linePlayTime = nextTime
    linePlayTimeStr.value = formatPlayTime2(nextTime)
    linePlayTop.value = lineRect.top + lineRect.height / 2 - parentRect.top
    linePlayVisible.value = true
  }
  const handleLyricMouseMove = event => {
    updateLinePlay(event.target)
  }
  const handleMove = (y) => {
    if (isMsDown.value) {
      isStopScroll.value ||= true
      hideLinePlay()
      if (cancelScrollFn) {
        cancelScrollFn()
        cancelScrollFn = null
      }
      dom_lyric.value.scrollTop = msDownScrollY + msDownY - y
      startLyricScrollTimeout()
      setTime()
    }
  }
  const handleMouseMsMove = event => {
    handleMove(event.clientY)
  }
  const handleTouchMove = (e) => {
    if (e.changedTouches.length) {
      const touch = e.changedTouches[0]
      handleMove(touch.clientY)
    }
  }

  const handleWheel = (event) => {
    isStopScroll.value ||= true
    hideLinePlay()
    if (cancelScrollFn) {
      cancelScrollFn()
      cancelScrollFn = null
    }
    dom_lyric.value.scrollTop = dom_lyric.value.scrollTop + event.deltaY
    startLyricScrollTimeout()
    setTime()
  }

  const setLyric = (lines) => {
    const dom_line_content = document.createDocumentFragment()
    lines.forEach((line, index) => {
      line.dom_line.dataset.lineIndex = String(index)
      dom_line_content.appendChild(line.dom_line)
    })
    dom_lyric_text.value.textContent = ''
    dom_lyric_text.value.appendChild(dom_line_content)
    nextTick(() => {
      dom_lines = dom_lyric.value.querySelectorAll('.line-content')
      handleScrollLrc()
    })
  }

  const initLrc = (lines, oLines) => {
    isSetedLines = true
    if (oLines) {
      if (lines.length) {
        setLyric(lines)
      } else {
        cancelScrollFn = scrollTo(dom_lyric.value, 0, 300, () => {
          if (lyric.lines !== lines) return
          setLyric(lines)
        }, 50)
      }
    } else {
      setLyric(lines)
    }
  }

  let delayScrollTimeout
  const scrollLine = (line, oldLine) => {
    if (line < 0) return
    if (line == 0 && isSetedLines) return isSetedLines = false
    isSetedLines &&= false
    if (oldLine == null || line - oldLine != 1) return handleScrollLrc()

    if (appSetting['playDetail.isDelayScroll']) {
      if (delayScrollTimeout) clearTimeout(delayScrollTimeout)
      delayScrollTimeout = setTimeout(() => {
        delayScrollTimeout = null
        handleScrollLrc(600)
      }, 600)
    } else {
      handleScrollLrc()
    }
  }

  watch(() => lyric.lines, initLrc)
  watch(() => lyric.line, scrollLine)

  onMounted(() => {
    document.addEventListener('mousemove', handleMouseMsMove)
    document.addEventListener('mouseup', handleMouseMsUp)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleMouseMsUp)

    initLrc(lyric.lines, null)
  })

  onBeforeUnmount(() => {
    clearLinePlayRetry()
    document.removeEventListener('mousemove', handleMouseMsMove)
    document.removeEventListener('mouseup', handleMouseMsUp)
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleMouseMsUp)
  })

  return {
    dom_lyric,
    dom_lyric_text,
    dom_skip_line,
    isStopScroll,
    isMsDown,
    linePlayVisible,
    linePlayTop,
    linePlayTimeStr,
    timeStr,
    handleLyricMouseDown,
    handleLyricTouchStart,
    handleLyricMouseMove,
    handleWheel,
    handleSkipPlay,
    handleSkipMouseEnter,
    handleSkipMouseLeave,
    handleLinePlay,
    handleLinePlayMouseEnter,
    handleLinePlayMouseLeave,
    handleScrollLrc,
  }
}
