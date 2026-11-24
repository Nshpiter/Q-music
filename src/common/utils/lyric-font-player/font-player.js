// const fontFormateRxp = /(?=<\d+,\d+>).*?/g
const fontSplitRxp = /(?=<\d+,\d+>).*?/g
const timeRxpAll = /<(\d+),(\d+)>/g
const timeRxp = /<(\d+),(\d+)>/


const emptySize = isVertical => isVertical ? '100% 0%' : '0% 100%'

function createAnimation(dom, startTime, duration, isVertical, wordMotion) {
  const first = { backgroundSize: emptySize(isVertical) }
  const last = { backgroundSize: wordMotion ? 'calc(100% + var(--lyric-feather, 0px)) 100%' : '100% 100%' }
  const frames = [first, last]
  if (wordMotion && duration >= 650 && dom.textContent.trim()) {
    dom.classList.add('sustained-word')
    first.top = last.top = '0em'
    frames.splice(1, 0,
      { offset: 0.18, top: '-0.025em' },
      { offset: 0.52, top: '-0.12em' },
      { offset: 0.72, top: '-0.115em' },
      { offset: 0.94, top: '-0.012em' },
    )
  }
  return new window.Animation(new window.KeyframeEffect(dom, frames, {
    delay: startTime,
    duration,
    fill: 'both',
  }), document.timeline)
}

export default class FontPlayer {
  constructor({
    time = 0,
    rate = 1,
    lyric = '',
    lineContentClassName = 'line-content',
    lineClassName = 'line',
    shadowClassName = 'shadow',
    fontModeClassName = 'font-mode',
    lineModeClassName = 'line-mode',
    fontLrcClassName = 'font-lrc',
    extendedLrcClassName = 'extended',
    shadowContent = false,
    extendedLyrics = [],
    isVertical = false,
    wordMotion = false,
  }) {
    this.time = time
    this.lyric = lyric

    this._rate = rate

    this.isVertical = isVertical
    this.wordMotion = wordMotion && !isVertical

    this.lineContentClassName = lineContentClassName
    this.lineClassName = lineClassName

    this.shadowContent = shadowContent
    this.shadowClassName = shadowClassName

    this.extendedLyrics = extendedLyrics
    this.fontModeClassName = fontModeClassName
    this.fontLrcClassName = fontLrcClassName
    this.extendedLrcClassName = extendedLrcClassName
    this.lineModeClassName = lineModeClassName


    this.isPlay = false
    this.lineContent = null

    this._init()
  }

  _init() {
    if (this.lyric == null) this.lyric = ''

    this.isLineMode = false

    this.lineContent = document.createElement('div')
    this.lineContent.time = this.time
    this.lineContent.className = this.lineContentClassName

    this.line = document.createElement('div')
    this.line.style = 'position:relative;display:inline-block;'
    this.line.className = this.lineClassName
    this.lineContent.appendChild(this.line)

    this.lrcContent = document.createElement('div')
    this.lrcContent.className = this.fontLrcClassName
    // if (this.shadowContent) {
    //   this.lrcShadowContent = document.createElement('div')
    //   this.lrcShadowContent.style = 'position:absolute;top:0;left:0;width:100%;z-index:-1;'
    //   this.lrcShadowContent.className = this.shadowClassName
    //   this.line.appendChild(this.lrcShadowContent)
    // }
    this.line.appendChild(this.lrcContent)

    for (const lrc of this.extendedLyrics) {
      const extendedLrcContent = document.createElement('div')
      extendedLrcContent.style = 'position:relative;display:inline-block;'
      extendedLrcContent.className = this.extendedLrcClassName
      this.lineContent.appendChild(document.createElement('br'))
      this.lineContent.appendChild(extendedLrcContent)


      // if (this.shadowContent) {
      //   const extendedLrcShadowContent = document.createElement('div')
      //   extendedLrcShadowContent.style = 'position:absolute;top:0;left:0;width:100%;z-index:-1;'
      //   extendedLrcShadowContent.className = this.shadowClassName
      //   extendedLrcShadowContent.textContent = lrc
      //   extendedLrcContent.appendChild(extendedLrcShadowContent)
      // }

      const lineContent = document.createElement('div')
      lineContent.className = this.fontLrcClassName
      lineContent.textContent = lrc.replace(timeRxpAll, '')
      extendedLrcContent.appendChild(lineContent)
    }
    this._parseLyric()
  }

  _parseLyric() {
    const fonts = this.lyric.split(fontSplitRxp)
    // console.log(fonts)

    this.fonts = []
    // let lineText = ''
    let lrcShadowContent
    for (const font of fonts) {
      const timing = font.match(timeRxp)
      if (!timing) return this._handleLineParse()
      const text = font.slice(timing[0].length)
      const startTime = Number(timing[1])
      const time = Number(timing[2])
      const dom = document.createElement('span')
      dom.textContent = text
      const animation = createAnimation(dom, startTime, time, this.isVertical, this.wordMotion)
      this.lrcContent.appendChild(dom)
      // lineText += text

      if (this.shadowContent) {
        lrcShadowContent ??= document.createElement('div')
        const shadowDom = document.createElement('span')
        shadowDom.textContent = text
        lrcShadowContent.appendChild(shadowDom)
      }
      // dom.style = shadowDom.style = this.fontStyle
      // dom.className = shadowDom.className = this.fontClassName

      this.fonts.push({
        text,
        startTime,
        time,
        dom,
        animation,
      })
    }

    if (this.shadowContent && lrcShadowContent) {
      lrcShadowContent.style = 'position:absolute;top:0;left:0;right:0;z-index:-1;'
      lrcShadowContent.className = this.shadowClassName
      this.line.appendChild(lrcShadowContent)
    }

    this.line.appendChild(this.lrcContent)
    // A sustained syllable can overlap the following word.
    const last = this.fonts.reduce((end, word) =>
      word.startTime + word.time >= end.startTime + end.time ? word : end)
    this.endTime = last.startTime + last.time
    last.animation.onfinish = () => {
      if (!this.isPlay || last.animation.playState !== 'finished') return
      this.lineContent.classList.add('played')
      this.isPlay = false
    }
    this.lineContent.classList.add(this.fontModeClassName)
    // if (this.shadowContent) this.lrcShadowContent.textContent = lineText
    // console.log(this.fonts)
  }

  _handleLineParse() {
    this.isLineMode = true
    this.lineContent.classList.add(this.lineModeClassName)
    this.lrcContent.textContent = this.lyric

    // if (this.shadowContent) this.lrcShadowContent.textContent = this.lyric
    this.fonts.push({
      text: this.lyric,
    })
  }

  play(curTime = 0) {
    if (this.isLineMode || curTime >= this.endTime) return this.finish()
    this.lineContent.classList.remove('played')
    this.isPlay = true
    for (const { dom, animation, startTime, time } of this.fonts) {
      if (curTime >= startTime + time) {
        animation.cancel()
        dom.style.backgroundSize = this.wordMotion ? 'calc(100% + var(--lyric-feather, 0px)) 100%' : '100% 100%'
        continue
      }
      dom.style.backgroundSize = ''
      // All words use the line's media time including their individual delays.
      animation.playbackRate = this._rate
      animation.currentTime = curTime
      animation.play()
    }
  }

  pause() {
    if (!this.isPlay) return
    this.isPlay = false
    for (const { animation } of this.fonts) {
      if (animation.playState === 'running') animation.pause()
    }
  }

  setPlaybackRate(rate) {
    this._rate = rate
    if (!this.isLineMode && this.isPlay) {
      for (const { animation } of this.fonts) animation.updatePlaybackRate(rate)
    }
  }

  finish() {
    this.setPlayed(true)
  }

  reset() {
    this.setPlayed(false)
  }

  setPlayed(played) {
    this.isPlay = false
    this.lineContent.classList.toggle('played', played)
    if (this.isLineMode) return
    for (const { dom, animation } of this.fonts) {
      animation.cancel()
      dom.style.backgroundSize = played ? '100% 100%' : emptySize(this.isVertical)
    }
  }
}

