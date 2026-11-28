const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function harness(file, more = {}, globals = {}) {
  const slots = [], effects = [], listeners = new Map()
  let cursor = 0
  const ref = { current: null }
  const element = (type, props, key) => ({ type, props, key })
  const react = {
    memo: fn => fn,
    forwardRef: fn => fn,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial == 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value == 'function' ? value(slots[i]) : value }] },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
    useMemo: fn => fn(), useCallback: fn => fn,
    useImperativeHandle: (target, fn) => { target.current = fn() },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() } }) },
  }
  const deps = {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': {
      Platform: { OS: 'android' }, View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable', Modal: 'NativeModal',
      StyleSheet: { create: value => value },
      AppState: { addEventListener: (_, fn) => { listeners.set('app', fn); return { remove: () => listeners.delete('app') } } },
      Animated: { View: 'AnimatedView', Value: class { stopAnimation() {} setValue() {} interpolate() {} }, spring: () => ({ start() {} }) },
    },
    'react-native-navigation': { Navigation: { events: () => ({ registerComponentDidDisappearListener: fn => { listeners.set('page', fn); return { remove: () => listeners.delete('page') } } }) } },
    '@/store/common/hook': { useStatusbarHeight: () => 24 },
    '@/utils/useMotion': { useMotion: () => true },
    '@/theme/ui': { Q_UI: { motion: { settle: {}, press: {} } } },
    './DockInset': { DockInsetContext: { Provider: 'Provider' } },
    './ModalBackHandler': 'ModalBackHandler',
    ...more,
  }
  const context = { exports: {}, ...globals, require: id => { if (!(id in deps)) throw Error(id); return deps[id] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, context)
  return { ref, listeners, render(props = {}, component = 'default') { cursor = 0; const result = context.exports[component](props, ref); while (effects.length) effects.shift()(); return result } }
}

function loadTracks(file, deps = {}) {
  const context = { exports: {}, require: id => { if (!(id in deps)) throw Error(id); return deps[id] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}
const trackSearch = loadTracks('src/utils/filterTracks.ts')
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[].concat(node.props?.children ?? []).flatMap(nodes)]

test('安卓歌曲菜单的所有操作都能从安装包字形表中找到图标', () => {
  const icoMoon = require('../src/resources/fonts/selection.json')
  const glyphs = {
    Feather: require('react-native-vector-icons/glyphmaps/Feather.json'),
    Ionicons: require('react-native-vector-icons/glyphmaps/Ionicons.json'),
    IcoMoon: Object.fromEntries(icoMoon.icons.map(icon => [icon.properties.name, icon.properties.code])),
  }
  const menu = loadTracks('src/utils/songMenu.ts').buildAndroidSongMenus({
    t: key => key, control: {}, includeMove: true, includeChangePosition: true,
    includeEditMetadata: true, includeToggleSource: true, includeRemove: true,
  })
  const icons = harness('src/components/common/Icon.tsx', {
    'react-native-vector-icons': { createIconSetFromIcoMoon: () => 'IcoMoon' },
    'react-native-vector-icons/Feather': 'Feather', 'react-native-vector-icons/Ionicons': 'Ionicons',
    '@/resources/fonts/selection.json': icoMoon, '@/utils/pixelRatio': { scaleSizeW: size => size },
    '@/store/theme/hook': { useTheme: () => ({}), useTextShadow: () => false },
  })
  for (const { action, icon } of menu) {
    const { type, props } = icons.render({ name: icon }, 'Icon')
    assert.ok(glyphs[type][props.name], action + ': ' + props.name)
  }
})

test('迷你播放栏左右滑切歌后，第一次点击即可打开详情；取消滑动不会切歌', () => {
  const played = []
  let opened = 0
  let gesture
  const h = harness('src/components/player/PlayerBar/components/Title.tsx', {
    'react-native': { StyleSheet: { create: value => value }, PanResponder: { create: handlers => {
      gesture = handlers
      return { panHandlers: {} }
    } }, Animated: { View: 'View', Value: class { stopAnimation() {} setValue() {} } } },
    '@/navigation': {}, '@/store/player/hook': { usePlayerMusicInfo: () => ({ id: 'a', name: 'A' }) },
    '@/store/common/state': {}, '@/store/player/state': {}, '@/config/constant': {}, '@/components/common/Button': 'Button',
    '@/components/common/Text': 'Text', '@/components/common/GlassSurface': { useGlassColors: () => ({}) },
    '@/components/player/useTrackChangeAnimation': { useTrackChangeAnimation: () => ({ transform: [] }) },
    '@/utils/hooks/useAdaptiveLayout': () => ({}), '@/utils/useMotion': { useInteractionMotion: () => false },
    '@/core/player/player': { playNext: () => played.push('next'), playPrev: () => played.push('prev') },
  })
  const button = h.render({ isHome: false, onOpenDetail: () => { opened++ } }).props.children
  for (const dx of [-60, 60]) {
    gesture.onPanResponderGrant()
    gesture.onPanResponderRelease(null, { dx, vx: 0 })
    assert.equal(opened, played.length - 1)
    button.props.onPress()
    assert.equal(opened, played.length)
  }
  gesture.onPanResponderGrant()
  gesture.onPanResponderTerminate()
  assert.deepEqual(played, ['next', 'prev'])
})

test('定时器等当前歌曲播完时保留活动按钮并朗读等待状态，取消后才恢复普通按钮', () => {
  let state = { time: 30, isPlayedStop: false }
  const h = harness('src/screens/PlayDetail/Vertical/components/TimeoutExitBtn.tsx', {
    '@/components/TimeoutExitEditModal': { __esModule: true, default: 'Modal', useTimeInfo: () => ({ active: state.time >= 0, isPlayedStop: state.isPlayedStop }) },
    '@/core/player/timeoutExit': { useTimeoutExitTimeInfo: () => state },
    '@/store/theme/hook': { useTheme: () => ({}) }, '@/components/common/Button': 'Button',
    '@/components/common/Text': 'Text', '@/components/common/Icon': { Icon: 'Icon' }, './Btn': 'Btn',
  }, { global: { i18n: { t: (key, args) => args?.time ?? key } } })
  const button = () => nodes(h.render()).find(node => node.type === 'Button' || node.type === 'Btn')
  assert.equal(button().props.accessibilityLabel, '00:30')
  state = { time: -1, isPlayedStop: true }
  assert.equal(button().type, 'Button')
  assert.equal(button().props.accessibilityLabel, 'timeout_exit_btn_wait_tip')
  assert.equal(nodes(button()).find(node => node.type === 'Text').props.children, '♪')
  state = { time: -1, isPlayedStop: false }
  assert.equal(button().type, 'Btn')
  assert.equal(button().props.accessibilityLabel, 'timeout_exit_tip_off')
})

test('安卓播放历史筛选后按最近或全局排名播放、移除指定条目，空结果不能清空历史', async () => {
  const entry = (id, name, albumName, playCount, playedAt) => ({
    track: { id, name, singer: 'ARTIST', source: 'tx', meta: { albumName } }, playCount, playedAt,
  })
  let entries = [entry('r', '夜曲 A', 'November', 1, 30), entry('x', 'other', 'Other', 100, 20), entry('p', '夜曲 B', 'November', 2, 10)]
  let notify
  const calls = []
  const h = harness('src/screens/PlayHistory/index.tsx', {
    '@/components/PageContent': 'Page', '@/components/common/StatusBar': 'Status', '@/components/common/Text': 'Text',
    '@/components/common/Button': 'Button', '@/components/common/IconButton': 'IconButton', '@/components/common/Input': 'Input',
    '@/components/common/Icon': { Icon: 'Icon' }, '@/components/TrackArtwork': 'Art', '@/components/SourceLogo': 'Logo',
    '@/components/player/PlayerBar': 'Player', '@/components/common/ConfirmAlert': 'Confirm', '@/components/MusicAddModal': 'Add',
    '@/components/SongMenuSheet': 'SongMenuSheet', '@/components/player/PlayingWave': { ActivePlayingWave: 'Wave' },
    '@/core/player/tempPlayList': { addTempPlayList: () => {} },
    '@/components/OnlineList/listAction': { handleDislikeMusic: () => {}, handleShare: () => {}, handleShowMusicSourceDetail: () => {} },
    '@/utils/songMenu': { buildAndroidSongMenus: () => [] },
    '@/core/playHistory': { playHistory: { snapshot: () => ({ entries }), subscribe: fn => { notify = fn }, load: async() => {},
      remove: async track => { calls.push(['remove', track.id]); entries = entries.filter(entry => entry.track !== track); notify() } } },
    '@/core/player/selection': {
      playFromPage: async (_, tracks, index) => calls.push(['play', ...tracks.map(track => track.id), index]),
      playAllFromPage: async (_, tracks) => calls.push(['all', ...tracks.map(track => track.id)]),
    },
    '@/store/player/hook': { usePlayMusicInfo: () => ({}) }, '@/store/theme/hook': { useTheme: () => ({}) },
    '@/lang': { useI18n: () => key => key }, '@/navigation': {}, '@/utils/tools': {}, '@/utils/filterTracks': trackSearch,
    '@/theme/ui': { Q_UI: { motion: { settle: {} }, radius: { control: 12 } } },
    'react-native': { View: 'View', FlatList: 'List', Keyboard: { dismiss() {} }, StyleSheet: { create: value => value },
      Animated: { Value: class { stopAnimation() {} }, spring: () => ({ start() {} }) } },
  })
  const tree = () => nodes(h.render({ componentId: 'history' }))
  const list = () => tree().find(node => node.type === 'List').props
  const button = key => tree().find(node => node.type === 'Button' && nodes(node).some(child => child.props?.children === key))
  tree().find(node => node.props?.accessibilityLabel === 'track_search_hint').props.onPress()
  const search = text => tree().find(node => node.type === 'Input').props.onChangeText(text)
  search('  NoV   夜曲 artist  ')
  assert.deepEqual(Array.from(list().data, row => row.track.id), ['r', 'p'])
  button('play_history_rank').props.onPress()
  const view = list()
  assert.deepEqual(Array.from(view.data, row => [row.track.id, row.rank]), [['p', 2], ['r', 3]])
  const row = view.renderItem({ item: view.data[1], index: 1 })
  const menu = () => tree().find(node => node.type === 'SongMenuSheet').props
  nodes(row).find(node => node.type === 'Button').props.onLongPress()
  assert.equal(menu().visible, true)
  menu().onClose()
  assert.equal(menu().visible, false)
  assert.equal(menu().musicInfo.id, 'r')
  menu().onClosed()
  assert.equal(menu().musicInfo, null)
  nodes(row).find(node => node.type === 'Button').props.onPress()
  button('play_history_play_results').props.onPress()
  nodes(row).find(node => node.props?.accessibilityLabel === 'play_history_remove').props.onPress()
  assert.deepEqual(calls, [['play', 'p', 'r', 1], ['all', 'p', 'r'], ['remove', 'r']])
  search('unmatched')
  assert.equal(list().data.length, 0)
  assert.equal(button('play_history_play_results').props.disabled, true)
  assert.equal(button('play_history_clear'), undefined)
  assert.ok(nodes(list().ListEmptyComponent).some(node => node.props?.children === 'play_history_search_empty'))
  tree().find(node => node.props?.accessibilityLabel === 'back').props.onPress()
  assert.deepEqual(Array.from(list().data, row => row.track.id), ['x', 'p'])
})

test('安卓队列搜索保留原序号，普通、重复插播和下载歌曲会播放所点条目', async () => {
  const rows = loadTracks('src/components/player/PlayQueue/rows.ts', { '@/utils/filterTracks': trackSearch })
  const song = (id, name) => ({ id, name, singer: 'ARTIST', source: 'tx', meta: { albumName: 'November' } })
  const later = song('same', '夜曲')
  const downloaded = { id: 'task', progress: 100, metadata: { musicInfo: song('music', '夜曲') } }
  const tracks = [song('1', '今日'), downloaded]
  const playback = { playerListId: 'queue', playerPlayIndex: 0 }
  const current = { isTempPlay: true, musicInfo: later }
  const player = { playInfo: playback, playMusicInfo: current, tempPlayList: [10, 11].map(tempId => ({ tempId, musicInfo: later })) }
  const played = []
  let finish
  const events = { on() {}, off() {} }
  const h = harness('src/components/player/PlayQueue/index.tsx', {
    './rows': rows, './DragRow': 'DragRow', '../PlayingWave': 'PlayingWave', '@/components/common/Input': 'Input', '@/components/SourceLogo': 'SourceLogo',
    '@/components/common/Button': 'Button', '@/components/common/BottomSheet': 'Sheet', '@/components/common/Text': 'Text',
    '@/components/common/Icon': { Icon: 'Icon' }, '@/lang': { useI18n: () => key => key }, '@/store/theme/hook': { useTheme: () => ({}) },
    'react-native': { View: 'View', FlatList: 'List', Keyboard: { dismiss() {} } },
    '@/store/player/hook': { useIsPlay: () => false, usePlayInfo: () => playback, usePlayMusicInfo: () => current },
    '@/store/player/state': player, '@/store/player/action': {}, '@/core/player/playInfo': { getList: () => tracks },
    '@/core/player/player': { playQueueIndex: at => { played.push(['list', at]) },
      playTempListByIndex: at => { played.push(['later', at]); return new Promise(resolve => { finish = resolve }) } },
    '@/core/player/session': { playbackSession: { subscribe() {} } }, '@/utils/tools': { createStyle: value => value },
  }, { global: { app_event: events, state_event: events } })
  h.render(); h.ref.current.show()
  nodes(h.render()).find(node => node.props?.accessibilityLabel === 'list_search').props.onPress()
  const search = query => nodes(h.render()).find(node => node.type === 'Input').props.onChangeText(query)
  const list = () => nodes(h.render()).find(node => node.type === 'List').props
  const row = (view, i) => view.renderItem({ item: view.data[i], index: i }).props.children[0].props
  search('artist 夜曲 novembER')
  let view = list()
  assert.deepEqual(Array.from(view.data, item => [item.kind, item.index, item.position]), [
    ['current', 0, 1], ['later', 0, 2], ['later', 1, 3], ['list', 1, 4],
  ])
  assert.equal(row(view, 0).isActive, true)
  row(view, 2).onPress()
  view = list()
  assert.equal(row(view, 2).busy, true)
  assert.equal(row(view, 1).busy, false)
  finish(); await new Promise(resolve => setImmediate(resolve))
  row(list(), 3).onPress()
  assert.deepEqual(played, [['later', 1], ['list', 1]])
  search('unmatched')
  assert.ok(nodes(list().ListEmptyComponent).some(node => node.type === 'Text' && node.props?.children === 'queue_search_empty'))
  h.render().props.onBack()
  assert.equal(list().data.length, 5)
  assert.equal(h.render().props.visible, true)
})

test('Android 隐藏弹窗卸载原生 Dialog，反复开关不保留可恢复的宿主', () => {
  const h = harness('src/components/common/Modal.tsx')
  let hides = 0
  const props = { onHide: () => hides++ }
  assert.equal(h.render(props), null)
  for (let i = 0; i < 5; i++) {
    h.ref.current.setVisible(true)
    assert.equal(h.render(props).type, 'NativeModal')
    h.ref.current.setVisible(false)
    assert.equal(h.render(props), null)
    h.ref.current.setVisible(false)
  }
  assert.equal(hides, 5)
})

test('临时面板进入后台或离开页面后关闭，回前台不重开；一般弹窗不强制清空', () => {
  const h = harness('src/components/common/Modal.tsx')
  const props = { transient: true }
  h.render(props); h.ref.current.setVisible(true); h.render(props)
  h.listeners.get('app')('background')
  assert.equal(h.render(props), null)
  h.listeners.get('app')('active')
  assert.equal(h.render(props), null)
  h.ref.current.setVisible(true); h.render(props)
  h.listeners.get('page')({ componentId: 'detail' })
  assert.equal(h.render(props), null)
  h.render({ transient: false })
  assert.equal(h.listeners.size, 0)
})

test('系统新返回与旧返回共用关闭回调，受控面板由父组件关闭，普通弹窗可再次打开', () => {
  const h = harness('src/components/common/Modal.tsx')
  h.render(); h.ref.current.setVisible(true)
  const native = h.render()
  const bridge = native.props.children.props.children.find(node => node?.type === 'ModalBackHandler')
  bridge.props.onBack()
  assert.equal(h.render(), null)
  h.ref.current.setVisible(true)
  assert.equal(h.render().type, 'NativeModal')
  let requests = 0
  const controlled = h.render({ keyHide: false, onRequestClose: () => requests++ })
  const controlledBridge = controlled.props.children.props.children.find(node => node?.type === 'ModalBackHandler')
  controlledBridge.props.onBack()
  assert.equal(requests, 1)
  assert.equal(h.render({ keyHide: false }).type, 'NativeModal')
})

test('播放设置关闭后清理子面板，不留下下一帧回调重开；再次打开仍正常', () => {
  const noop = () => null
  const h = harness('src/screens/PlayDetail/components/SettingPopup/index.tsx', {
    '@/components/common/Popup': 'Popup', '@/lang': { useI18n: () => key => key },
    './settings/SettingLyricProgress': noop, './settings/SettingVolume': noop, './settings/SettingPlaybackRate': noop,
    './settings/SettingLrcFontSize': noop, './settings/SettingLrcAlign': noop, './settings/SettingPlayQuality': noop,
    '@/components/player/PlayerStyleSelector': noop, '@/components/player/LyricFontSelector': noop,
  })
  assert.equal(h.render({}), null)
  h.ref.current.show()
  const open = h.render({})
  assert.equal(open.type, 'Popup')
  assert.equal(open.props.transient, true)
  open.props.onHide()
  assert.equal(h.render({}), null)
  h.ref.current.show()
  assert.equal(h.render({}).type, 'Popup')
})

test('播放按钮仅纵向扩张热区，横向不进入相邻按钮；切换图标保持回调', () => {
  const h = harness('src/components/player/TransportButton.tsx', {
    '@/components/common/Button': 'Button', '@/components/common/Icon': { Icon: 'Icon' },
    '@/store/theme/hook': { useTheme: () => ({ 'q-text-primary': '#fff', 'c-content-background': '#000' }) },
  })
  let presses = 0
  for (const size of [40, 44, 48, 56]) {
    for (const icon of ['prevMusic', 'play', 'pause', 'nextMusic']) {
      const button = h.render({ size, icon, label: icon, onPress: () => presses++ })
      assert.equal(button.props.hitSlop.left, 0)
      assert.equal(button.props.hitSlop.right, 0)
      assert.equal(button.props.pressRetentionOffset.left, 0)
      assert.equal(button.props.pressRetentionOffset.right, 0)
      button.props.onPress()
    }
  }
  assert.equal(presses, 16)
})
