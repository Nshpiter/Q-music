// 任务栏和 OBS 使用同一个逐字时钟。平时交给合成器推进，只在跳播或漂移时校准。
function createTimedLine(element) {
  let animations = []
  let active = false
  const clear = () => {
    for (const animation of animations) animation.cancel()
    animations = []
    element.replaceChildren()
  }
  const setLine = (text, words) => {
    clear()
    if (!words?.length || words.map(word => word.text).join('') !== text || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.textContent = text
      return
    }
    for (const word of words) {
      const span = document.createElement('span')
      span.className = 'timed-word'
      span.textContent = word.text
      element.append(span)
      const animation = span.animate([{ backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%' }], {
        delay: word.start, duration: Math.max(1, word.duration), fill: 'both', easing: 'linear',
      })
      animation.pause()
      animations.push(animation)
    }
  }
  const sync = (seconds, rate, playing) => {
    const time = Math.max(0, seconds * 1000)
    for (const animation of animations) {
      if (animation.playbackRate !== rate) animation.playbackRate = rate
      if (active !== playing || Math.abs(Number(animation.currentTime) - time) > 140 || animation.currentTime == null) animation.currentTime = time
      if (playing && animation.playState === 'paused') animation.play()
      if (!playing && animation.playState === 'running') animation.pause()
    }
    active = playing
  }
  return { setLine, sync }
}

window.createTimedLine = createTimedLine
