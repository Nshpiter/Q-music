import { ref, onMounted, onBeforeUnmount, watch, nextTick } from '@common/utils/vueTools'
import { throttle, formatPlayTime2 } from '@common/utils/common'
import { scrollTo } from '@common/utils/renderer'
import { play } from '@renderer/core/player/action'
import { appSetting } from '@renderer/store/setting'
import useFurigana from './useFurigana'
import { layoutFan } from '../refinedNowPlaying/fanLayout'
import { getCurrentTime, getDuration, getPlaybackRate } from '@renderer/plugins/player'
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
  const linePlayLeft = ref(0)
  const linePlayTimeStr = ref('--:--')

  let msDownY = 0
  let msDownScrollY = 0
  let timeout = null
  let cancelScrollFn
  let dom_lines
  let currentLineElement = null
  let fanFocus = -1
  let fanAdvanceTimer
  let fanDragY = 0
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

  const seekLyricTime = (targetTime, startPlaying) => {
    if (!Number.isFinite(targetTime) || targetTime < 0) return
    clearLyricScrollTimeout()
    clearLinePlayRetry()
    hideLinePlay()
    isStopScroll.value = false
    if (startPlaying && !isPlay.value && !getDuration()) setLinePlayProgress(targetTime)
    else window.app_event.setProgress(targetTime)
    if (startPlaying && !isPlay.value) play()
  }
  const seekLyricLine = (index, startPlaying) => seekLyricTime(getPlayTime(index), startPlaying)
  const handleLinePlay = () => seekLyricTime(linePlayTime, true)

  const handleSkipPlay = () => {
    if (time == -1) return
    handleSkipMouseLeave()
    seekLyricTime(time, true)
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
    if (appSetting['playDetail.fanLyrics'] && fanFocus >= 0) {
      time = getPlayTime(fanFocus)
      timeStr.value = time >= 0 ? formatPlayTime2(time) : '--:--'
      return
    }
    const rect = dom_skip_line.value.getBoundingClientRect()
    point.x = rect.x
    point.y = rect.y
    let dom = document.elementFromPoint(point.x, point.y)
    if (!dom) return
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
    const focusRatio = isShowPlayComment?.value ? 0.1 : 0.5
    const lineRect = dom_p?.getBoundingClientRect()
    const rawTarget = lineRect
      ? dom.scrollTop + lineRect.top - dom.getBoundingClientRect().top + (isShowPlayComment?.value ? 0 : lineRect.height / 2) - dom.clientHeight * focusRatio
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

  const renderFan = (index, animate) => {
    const view = dom_lyric.value
    if (!dom_lines?.length || !view?.clientHeight) return
    const previous = fanFocus
    fanFocus = Math.min(Math.max(0, index), dom_lines.length - 1)
    const transforms = layoutFan({
      heights: Array.from(dom_lines, row => row.clientHeight),
      fontSize: parseFloat(window.getComputedStyle(view).fontSize),
      anchor: view.clientHeight * (isShowPlayComment?.value ? 0.1 : 0.5),
      currentLineForScrolling: fanFocus,
      previousLine: previous,
      scrollingMode: isStopScroll.value,
      lyricStagger: true,
      lyricZoom: appSetting['playDetail.isZoomActiveLrc'],
      RotateCurvature: appSetting['playDetail.fanCurvature'],
    })
    for (const [i, t] of transforms.entries()) {
      const row = dom_lines[i]
      // 歌词栏在封面右边，以栏的右缘为轴镜像上游位移和旋转，文字本身保持正向。
      row.style.setProperty('--rnp-transform', `translateX(${-(t.left ?? 0)}px) translateY(${t.top + (t.extraTop ?? 0)}px) scale(${t.scale}) rotate(${-(t.rotate ?? 0)}deg)`)
      row.style.setProperty('--rnp-opacity', String(t.opacity ?? 1))
      row.style.setProperty('--rnp-duration', animate && previous >= 0 ? '500ms' : '0ms')
      row.style.setProperty('--rnp-delay', animate && previous >= 0 ? t.delay + 'ms' : '0ms')
      row.classList.toggle('rnp-out-of-range', !!t.outOfRangeHidden)
    }
  }

  const syncFan = (animate) => {
    clearTimeout(fanAdvanceTimer)
    if (!dom_lines?.length) return
    if (isStopScroll.value) return renderFan(fanFocus, false)
    let index = getCurrentLineIndex()
    if (!isPlay.value) return renderFan(index, animate)
    // 上游在错峰模式下提前 200ms 换行，逐字染色仍由实际音频时间驱动。
    const threshold = getCurrentTime() * 1000 + lyric.offset + lyric.tempOffset + 200
    while (lyric.lines[index + 1]?.time <= threshold) index++
    if (index !== fanFocus || !animate) renderFan(index, animate)
    const next = lyric.lines[index + 1]
    if (next) fanAdvanceTimer = setTimeout(() => syncFan(true), Math.max(1, (next.time - threshold) / getPlaybackRate()))
  }

  const handleScrollLrc = (duration = 300, force = false) => {
    if (appSetting['playDetail.fanLyrics']) {
      stopScrollAnimation()
      if (force) {
        isStopScroll.value = false
        hideLinePlay()
      }
      return syncFan(duration > 0)
    }
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
    if (duration <= 0 || appSetting['common.performanceMode'] || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
  const resumeLyricFollow = () => {
    clearLyricScrollTimeout()
    isStopScroll.value = false
    hideLinePlay()
    handleScrollLrc(300, true)
  }
  const startLyricScrollTimeout = () => {
    clearLyricScrollTimeout()
    if (!isStopScroll.value || !isPlay.value || isSkipMouseEnter || isMsDown.value) return
    timeout = setTimeout(resumeLyricFollow, 3000)
  }
  const handleLyricDown = (y) => {
    if (!dom_lines?.length) return
    isMsDown.value = true
    msDownY = fanDragY = y
    msDownScrollY = dom_lyric.value.scrollTop
  }
  const handleLyricMouseDown = event => {
    if (event.button !== 0) return
    handleLyricDown(event.clientY)
  }
  const handleLyricTouchStart = event => {
    if (event.changedTouches.length) {
      const touch = event.changedTouches[0]
      handleLyricDown(touch.clientY)
    }
  }
  const handleMouseMsUp = event => {
    if (!isMsDown.value) return
    isMsDown.value = false
    startLyricScrollTimeout()
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
    linePlayTop.value = lineRect.top + lineRect.height / 2
    linePlayLeft.value = parentRect.right + 4
    linePlayVisible.value = true
  }
  const handleLyricMouseMove = event => {
    updateLinePlay(event.target)
  }
  const handleMove = (y) => {
    if (isMsDown.value) {
      if (!isStopScroll.value && Math.abs(y - msDownY) < 4) return
      isStopScroll.value = true
      hideLinePlay()
      stopScrollAnimation()
      if (appSetting['playDetail.fanLyrics']) {
        const distance = fanDragY - y
        const step = Math.trunc(distance / Math.max(1, dom_lines?.[fanFocus]?.clientHeight || 32))
        if (step) {
          renderFan(fanFocus + step, true)
          fanDragY = y
        }
      } else dom_lyric.value.scrollTop = msDownScrollY + msDownY - y
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
    if (!dom_lines?.length || !event.deltaY) return
    isStopScroll.value ||= true
    hideLinePlay()
    stopScrollAnimation()
    if (appSetting['playDetail.fanLyrics']) renderFan(fanFocus + Math.sign(event.deltaY), true)
    else dom_lyric.value.scrollTop += event.deltaY
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
      fanFocus = -1
      updateCurrentLine(lyric.line)
      handleScrollLrc()
    })
  }

  const updateCurrentLine = line => {
    if (!dom_lines) return
    const next = dom_lines[line] ?? null
    if (next === currentLineElement) return
    currentLineElement?.classList.remove('q-current-line')
    next?.classList.add('q-current-line')
    currentLineElement = next
  }

  const initLrc = (lines, oLines) => {
    clearLyricScrollTimeout()
    isMsDown.value = false
    isStopScroll.value = false
    isSkipMouseEnter = false
    hideLinePlay()
    clearLinePlayRetry()
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

  const scrollLine = (line, oldLine) => {
    updateCurrentLine(line)
    if (line < 0) return
    if (line == 0 && isSetedLines) return isSetedLines = false
    isSetedLines &&= false
    if (oldLine == null || line - oldLine != 1) return handleScrollLrc()

    handleScrollLrc(appSetting['playDetail.isDelayScroll'] ? 460 : 290)
  }

  watch(() => lyric.lines, initLrc)
  useFurigana(lyric, appSetting, () => nextTick(() => handleScrollLrc(0)))
  watch(() => lyric.line, scrollLine)
  watch(() => appSetting['playDetail.fanLyrics'], () => {
    const view = dom_lyric.value
    if (!view) return
    clearTimeout(fanAdvanceTimer)
    clearLyricScrollTimeout()
    stopScrollAnimation()
    isMsDown.value = false
    // 两种排列的定位和行距不同，按切换后的真实行高一次定位到当前歌词。
    view.dataset.arranging = ''
    fanFocus = -1
    view.scrollTop = 0
    handleScrollLrc(0, true)
    view.getBoundingClientRect()
    delete view.dataset.arranging
  }, { flush: 'post' })
  watch([() => appSetting['playDetail.fanCurvature'], () => appSetting['playDetail.isZoomActiveLrc']], () => {
    nextTick(() => handleScrollLrc(0, true))
  })
  watch([isPlay, () => appSetting['player.playbackRate']], () => {
    if (appSetting['playDetail.fanLyrics']) syncFan(false)
  })
  watch(isPlay, startLyricScrollTimeout)
  const seekFan = () => {
    if (appSetting['playDetail.fanLyrics']) nextTick(() => handleScrollLrc(0, true))
  }
  watch(() => [isShowPlayComment?.value, appSetting['playDetail.style.layout']], hideLinePlay)

  onMounted(() => {
    window.app_event.on('setProgress', seekFan)
    window.addEventListener('resize', hideLinePlay)
    document.addEventListener('mousemove', handleMouseMsMove)
    document.addEventListener('mouseup', handleMouseMsUp)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleMouseMsUp)
    document.addEventListener('touchcancel', handleMouseMsUp)

    initLrc(lyric.lines, null)
  })

  onBeforeUnmount(() => {
    window.app_event.off('setProgress', seekFan)
    clearTimeout(fanAdvanceTimer)
    window.removeEventListener('resize', hideLinePlay)
    clearLinePlayRetry()
    stopScrollAnimation()
    clearLyricScrollTimeout()
    document.removeEventListener('mousemove', handleMouseMsMove)
    document.removeEventListener('mouseup', handleMouseMsUp)
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleMouseMsUp)
    document.removeEventListener('touchcancel', handleMouseMsUp)
  })

  return {
    dom_lyric,
    dom_lyric_text,
    dom_skip_line,
    isStopScroll,
    isMsDown,
    linePlayVisible,
    linePlayTop,
    linePlayLeft,
    linePlayTimeStr,
    timeStr,
    handleLyricMouseDown,
    handleLyricTouchStart,
    handleLyricMouseMove,
    handleWheel,
    resumeLyricFollow,
    seekLyricLine,
    handleSkipPlay,
    handleSkipMouseEnter,
    handleSkipMouseLeave,
    handleLinePlay,
    handleLinePlayMouseEnter,
    handleLinePlayMouseLeave,
    handleScrollLrc,
  }
}
