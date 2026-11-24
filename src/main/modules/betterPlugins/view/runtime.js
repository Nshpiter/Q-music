/* global pluginHost, EventTarget, MutationObserver, CustomEvent */
'use strict'

const settings = document.getElementById('settings')
const status = document.querySelector('[role=status]')
const songInfo = new EventTarget()
let track = {}
const currentSong = () => ({
  data: {
    id: track.songId || 0,
    name: track.name || '',
    duration: (track.duration || 0) * 1000,
    artists: (track.singer || '').split('、').filter(Boolean).map(name => ({ name })),
    album: { name: track.albumName || '', picUrl: track.picUrl || '' },
  },
})
songInfo.getPlaying = currentSong
songInfo.getMusicId = () => currentSong().data.id
const media = new EventTarget()
const repeatModes = { None: 'list', Track: 'singleLoop', List: 'listLoop' }
const repeatMode = () => track.playMethod === 'singleLoop' ? 'Track' : track.playMethod === 'listLoop' || track.playMethod === 'random' ? 'List' : 'None'
window.InfLinkApi = Object.assign(media, {
  version: '3.4.0',
  getCurrentSong: () => track.name ? {
    songName: track.name,
    authorName: track.singer,
    albumName: track.albumName,
    duration: Math.round((track.duration || 0) * 1000),
    ncmId: track.songSource === 'wy' ? Number(track.songId) || 0 : 0,
    trackId: String(track.songId || track.name),
    cover: track.picUrl ? { url: track.picUrl } : null,
  } : null,
  getPlaybackStatus: () => track.status === 'playing' ? 'Playing' : track.status === 'stoped' ? 'Stopped' : 'Paused',
  getTimeline: () => track.duration > 0 ? { currentTime: Math.round((track.progress || 0) * 1000), totalTime: Math.round(track.duration * 1000) } : null,
  getPlayMode: () => ({ isShuffling: track.playMethod === 'random', repeatMode: repeatMode() }),
  getVolume: () => ({ volume: (track.volume ?? 100) / 100, isMuted: !!track.mute }),
  play: () => pluginHost.playback('play'),
  pause: () => pluginHost.playback('pause'),
  stop: () => { pluginHost.playback('pause'); pluginHost.playback('seek', 0) },
  previous: () => pluginHost.playback('prev'),
  next: () => pluginHost.playback('next'),
  seekTo: ms => pluginHost.playback('seek', ms / 1000),
  setVolume: volume => pluginHost.playback('volume', volume),
  toggleMute: () => pluginHost.playback('mute', !track.mute),
  toggleShuffle: () => pluginHost.playback('playMode', track.playMethod === 'random' ? 'list' : 'random'),
  toggleRepeat: () => pluginHost.playback('playMode', { None: 'listLoop', List: 'singleLoop', Track: 'list' }[repeatMode()]),
  setRepeatMode: mode => { if (Object.hasOwn(repeatModes, mode)) pluginHost.playback('playMode', repeatModes[mode]) },
})
const mediaEvent = (type, detail) => media.dispatchEvent(new CustomEvent(type, { detail }))
const nativeListeners = new Map()
window.legacyNativeCmder = {
  appendRegisterCall(event, module, listener) {
    if (module !== 'audioplayer' || typeof listener !== 'function') return
    if (!nativeListeners.has(event)) nativeListeners.set(event, new Set())
    nativeListeners.get(event).add(listener)
  },
  removeRegisterCall(event, module, listener) {
    if (module === 'audioplayer') nativeListeners.get(event)?.delete(listener)
  },
}
function emitAudio(event, ...args) {
  for (const listener of nativeListeners.get(event) || []) {
    try { listener(...args) } catch (error) { console.error(error) }
  }
}
const lyricFields = ['lyric', 'lxlyric', 'tlyric', 'rlyric']
function syncLyrics() {
  const api = window.qPluginLyrics
  const lyrics = api.parseLyric(track.lyric, track.tlyric, track.rlyric, api.convertDynamic(track.lxlyric))
  const hash = api.lyricHash(lyrics.map(row => row.originalLyric).join('\\'))
  window.currentLyrics = { lyrics, contributors: {}, hash: (track.songId || track.name || '0') + '-' + hash }
  document.dispatchEvent(new CustomEvent('lyrics-updated', { detail: window.currentLyrics }))
}
function update(changes) {
  const previous = track
  const next = track = { ...previous, ...changes }
  songInfo.trackPlaying = currentSong()
  songInfo.playState = next.status === 'playing' ? 1 : 2
  songInfo.duration = (next.duration || 0) * 1000
  songInfo.playProgress = (next.progress || 0) * 1000
  songInfo.autioId = String(next.songId || '')
  const songChanged = previous.songId !== next.songId || previous.name !== next.name || previous.singer !== next.singer
  if (songChanged || previous.picUrl !== next.picUrl || previous.albumName !== next.albumName || previous.duration !== next.duration) mediaEvent('songChange', media.getCurrentSong())
  if (previous.status !== next.status) mediaEvent('playStateChange', media.getPlaybackStatus())
  if (previous.progress !== next.progress || previous.duration !== next.duration) {
    mediaEvent('rawTimelineUpdate', media.getTimeline())
    mediaEvent('timelineUpdate', media.getTimeline())
  }
  if (previous.volume !== next.volume || previous.mute !== next.mute) mediaEvent('volumeChange', media.getVolume())
  if (previous.playMethod !== next.playMethod) mediaEvent('playModeChange', media.getPlayMode())
  if (songChanged) {
    document.querySelector('#name').textContent = next.name
    document.querySelector('#singer').textContent = next.singer
    songInfo.dispatchEvent(new Event('audio-id-updated'))
    if (previous.name) emitAudio('End', String(previous.songId || ''))
  }
  if (songChanged || previous.duration !== next.duration) emitAudio('Load', songInfo.autioId, { duration: next.duration || 0 })
  if (previous.status !== next.status) {
    songInfo.dispatchEvent(new Event('play-state-updated'))
    emitAudio('PlayState', songInfo.autioId, 'play|' + (songInfo.playState === 1 ? 'resume' : 'pause'), 0)
  }
  if (previous.progress !== next.progress) {
    songInfo.dispatchEvent(new Event('play-progress-updated'))
    emitAudio('PlayProgress', songInfo.autioId, next.progress || 0, 0)
  }
  if (previous.duration !== next.duration) songInfo.dispatchEvent(new Event('duration-updated'))
  if (songChanged || lyricFields.some(field => previous[field] !== next[field])) syncLyrics()
  if (!!previous.detailVisible !== !!next.detailVisible) window.dispatchEvent(new Event(next.detailVisible ? 'rnp-lyric-page-opened' : 'rnp-lyric-page-closed'))
}
function waitForElement(selector) {
  const present = document.querySelector(selector)
  if (present) return Promise.resolve(present)
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element) { observer.disconnect(); clearTimeout(timeout); resolve(element) }
    })
    const timeout = setTimeout(() => { observer.disconnect(); reject(Error('Missing element ' + selector)) }, 5000)
    observer.observe(document.body, { childList: true, subtree: true })
  })
}

function dom(tag, props = {}, ...children) {
  const el = document.createElement(tag)
  for (const [name, value] of Object.entries(props || {})) {
    if (name === 'style' && value && typeof value === 'object') Object.assign(el.style, value)
    else if (name in el) el[name] = value
    else el.setAttribute(name, value)
  }
  for (const child of children.flat(Infinity)) if (child != null && child !== false) el.append(child)
  return el
}
window.dom = dom
window.h = window.React.createElement
const configTools = {
  makeBtn: (label, onclick) => dom('button', { type: 'button', textContent: label, onclick }),
  makeInput: (value, props) => dom('input', { value, ...props }),
}
pluginHost.listen(update)
const controls = document.querySelector('.btns')
const actionKeys = new WeakMap()
const actionElements = new Map()
let nextKey = 0
function publishActions() {
  actionElements.clear()
  const rows = []
  for (const element of controls.querySelectorAll('button, a, .btn, [role="button"]')) {
    if (rows.length >= 24) break
    const label = (element.title || element.getAttribute('aria-label') || element.textContent).trim().slice(0, 100)
    if (!label || element.hidden || element.disabled || !element.getClientRects().length) continue
    if (!actionKeys.has(element)) actionKeys.set(element, ++nextKey)
    const key = actionKeys.get(element)
    actionElements.set(key, element)
    rows.push({ key, label })
  }
  pluginHost.actions(rows)
}
new MutationObserver(publishActions).observe(controls, { childList: true, subtree: true, attributes: true, characterData: true })
pluginHost.invoke(key => { actionElements.get(key)?.click() })
pluginHost.start(async(items, initial) => {
  const item = items[items.length - 1]
  document.title = document.querySelector('h1').textContent = item.name
  const owners = items.map(pkg => {
    const isRoot = pkg === item
    const path = isRoot ? '/plugin' : '/deps/' + encodeURIComponent(pkg.id)
    const prefix = isRoot ? '' : path + ':'
    const load = []
    const ready = []
    const configs = []
    const plugin = Object.assign(new EventTarget(), {
      pluginPath: path,
      manifest: { slug: pkg.id, name: pkg.name, version: pkg.version },
      onLoad: fn => load.push(fn),
      onConfig: fn => configs.push(fn),
      onAllPluginsLoaded: fn => ready.push(fn),
      getConfig(key, fallback) { const value = window.localStorage.getItem(prefix + key); return value === null ? fallback : JSON.parse(value) },
      setConfig(key, value) { window.localStorage.setItem(prefix + key, JSON.stringify(value)) },
    })
    plugin.mainPlugin = plugin
    return { pkg, plugin, path, load, ready, configs }
  })
  const fs = window.createPluginFiles(owners)
  const openUrl = url => { if (typeof url === 'string' && url.startsWith('https://')) window.open(url, '_blank', 'noopener') }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
  const betterncm = {
    ncm: {
      getPlayingSong: currentSong,
      getPlaying: () => ({ id: songInfo.getMusicId(), title: track.name, artist: track.singer, album: track.albumName }),
      findApiFunction: name => ['getPlaying', 'baJ'].includes(name) ? [currentSong, null] : undefined,
      openUrl,
    },
    fs,
    utils: {
      dom,
      waitForElement,
      delay,
      openUrl,
      async waitForFunction(fn, interval = 100) {
        for (;;) { const result = fn(); if (result) return result; await delay(Math.max(16, Number(interval) || 100)) }
      },
      debounce(fn, ms = 100) {
        let timer
        return function(...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), ms) }
      },
    },
    app: {
      exec: async url => {
        if (typeof url !== 'string' || !url.startsWith('https://')) throw Error('Native command requires the NetEase client')
        openUrl(url)
      },
      readConfig: async(key, fallback) => itemConfig.getConfig(key, fallback),
      writeConfig: async(key, value) => itemConfig.setConfig(key, value),
    },
  }
  const itemConfig = owners[owners.length - 1].plugin
  const plugins = Object.create(null)
  plugins.InfLinkrs = media
  plugins.LibSongInfo = songInfo
  plugins.LibLyric = {
    ...window.qPluginLyrics,
    getLyricData: async id => {
      if (String(id) !== String(songInfo.getMusicId())) return pluginHost.lyrics(id)
      return { code: 200, lrc: { lyric: track.lyric }, tlyric: { lyric: track.tlyric }, romalrc: { lyric: track.rlyric }, yrc: { lyric: window.qPluginLyrics.convertDynamic(track.lxlyric) } }
    },
  }
  plugins.LibEAPIRequest = {
    eapiRequest(url, options) {
      let call
      try {
        const path = new URL(url, 'https://music.163.com')
        if (path.hostname !== 'music.163.com' || !['/api/song/lyric/v1', '/api/song/lyric'].includes(path.pathname)) throw Error('Unsupported NetEase endpoint')
        call = plugins.LibLyric.getLyricData(options.query?.id)
      } catch (err) { call = Promise.reject(err) }
      return call.then(result => { options.onload?.(result); return result }, err => {
        if (options.onerror) return options.onerror(err)
        throw err
      })
    },
  }
  window.APP_CONF = { domain: 'https://music.163.com' }
  plugins.StylesheetLoader = {
    loadStylesheet: async(owner, path, id, options = {}) => {
      const sheet = document.createElement('style')
      sheet.textContent = await fs.readFileText(path)
      document.head.appendChild(sheet)
      for (const [key, option] of Object.entries(options)) {
        const label = document.createElement('label')
        const input = document.createElement('input')
        input.type = option.type === 'checkbox' ? 'checkbox' : 'text'
        const value = owner.getConfig(key, option.default)
        input.checked = !!value
        input.value = String(value ?? '')
        const apply = val => {
          if (option.reflect === 'bodyFlag' && option.class) document.body.classList.toggle(option.class, !!val)
          else if (option.key?.startsWith('--')) document.documentElement.style.setProperty(option.key, val)
        }
        apply(value)
        input.addEventListener('change', () => {
          const value = input.type === 'checkbox' ? input.checked : input.value
          owner.setConfig(key, value)
          apply(value)
        })
        label.append(option.name || key, input)
        settings.append(label, document.createElement('br'))
      }
    },
  }
  plugins.PluginMarket = { addTemporaryCustomSource: url => pluginHost.suggestSource(url) }
  const nowPlaying = { get currentLyrics() { return window.currentLyrics } }
  for (const name of ['RefinedNowPlaying', 'RefinedNowPlaying-Enhanced', 'RefinedNowPlayingNext']) plugins[name] = nowPlaying
  const bind = (key, value) => {
    if (typeof key === 'string' && key && !Object.hasOwn(plugins, key)) plugins[key] = value
  }
  for (const [key, value] of Object.entries(plugins)) bind(key.toLowerCase(), value)
  for (const { pkg, plugin } of owners) {
    for (const key of [pkg.id, pkg.id.toLowerCase(), pkg.name]) bind(key, plugin)
  }
  for (const { pkg } of owners) {
    for (const key of pkg.requirements) bind(key, plugins[key.toLowerCase()])
  }
  window.betterncm = betterncm
  window.loadedPlugins = plugins
  update(initial)
  try {
    for (const { pkg, plugin, load } of owners) {
      for (const script of pkg.scripts) {
        // 脚本仅在独立的 Chromium 沙箱窗口执行。
        const run = new Function('plugin', 'betterncm', 'loadedPlugins', pkg.assets[script]) // eslint-disable-line no-new-func
        run.call(plugin, plugin, betterncm, plugins)
      }
      for (const fn of load) {
        const result = await fn.call(plugin, plugin)
        if (result && typeof result === 'object') Object.assign(plugin, result)
      }
    }
    for (const { ready, plugin } of owners) {
      for (const fn of ready) await fn.call(plugin, plugins)
    }
    const { configs, plugin } = owners[owners.length - 1]
    for (const fn of configs) {
      const node = await fn.call(plugin, Object.assign(Object.create(plugin), configTools))
      if (node instanceof window.Node) settings.appendChild(node)
    }
    // 已注册 MutationObserver 的插件在首轮渲染后生成歌曲操作。
    document.querySelector('.btns').appendChild(document.createTextNode(''))
    if (track.detailVisible) window.dispatchEvent(new Event('rnp-lyric-page-opened'))
    pluginHost.loaded('')
  } catch (err) {
    status.textContent = String(err.message || err)
    pluginHost.loaded(status.textContent || 'plugin_runtime')
  }
})
