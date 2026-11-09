const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), ts = require("typescript")
const load = (file, deps = {}, globals = {}) => {
 const context = { exports: {}, require: id => { if (!(id in deps)) throw Error(id); return deps[id] }, ...globals }
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
 return context.exports
}
const identities = load("src/renderer/core/music/playbackReport.ts")
const track = (source = "wy", songId = "123", albumId = "invalid") => ({ id: "a", source, meta: { songId, albumId } })
const route = (extra = {}) => ({ musicKey: "wy:a", requestedSource: "wy", resolvedSource: "tx", resolvedSongId: "wrong-song", mode: "fallback", reportIdentity: identities.originalReportIdentity(track()), ...extra })
test("原曲网易云身份独立于线路，拒绝过期、本地和无效身份；QQ 官方行为保留", () => {
 for (const mode of ["api", "fallback", "cache", "official"]) {
  const info = identities.playbackReportInfo(route({ mode }), "wy:a")
  assert.equal(info.provider, "wy"); assert.equal(info.songId, "123"); assert.equal(info.sourceId, "0")
 }
 for (const mode of ["local", "download"]) assert.equal(identities.playbackReportInfo(route({ mode }), "wy:a"), null)
 assert.equal(identities.playbackReportInfo(route(), "wy:b"), null)
 for (const id of ["", "abc", "0", "-1"]) assert.equal(identities.originalReportIdentity(track("wy", id)), null)
 assert.equal(identities.originalReportIdentity(track("tx")), null)
 assert.equal(identities.originalReportIdentity(track("wy", "123", "456")).sourceId, "456")
 assert.equal(identities.playbackReportInfo(route({ requestedSource: "tx", reportIdentity: null }), "wy:a"), null)
 assert.equal(identities.playbackReportInfo(route({ mode: "official", requestedSource: "tx", resolvedSource: "wy", resolvedSongId: "123", reportIdentity: null }), "wy:a"), null)
 const qq = identities.playbackReportInfo(route({ mode: "official", requestedSource: "tx", reportIdentity: null, resolvedMediaId: "media" }), "wy:a")
 assert.equal(qq.provider, "tx"); assert.equal(qq.mediaId, "media")
})
function harness() {
 let time = 0, position = 0, interval, unmount
 const events = new Map(), calls = [], timers = new Set()
 const state = { playMusicInfo: { musicInfo: track() }, playbackSourceInfo: { value: route() } }
 const use = load("src/renderer/core/useApp/usePlayer/useOfficialPlaybackReport.ts", {
  "@common/utils/vueTools": { onBeforeUnmount: fn => { unmount = fn } },
  "@renderer/plugins/player": { getCurrentTime: () => position }, "@renderer/store/player/state": state,
  "@renderer/core/music/playbackReport": identities,
  "@renderer/utils/ipc": { reportMusicAccountPlayback: async data => { calls.push(data); return { status: "reported" } } },
 }, { performance: { now: () => time }, Date, console, setInterval: fn => { interval = fn }, clearInterval: () => {}, setTimeout: fn => { timers.add(fn); return fn }, clearTimeout: fn => timers.delete(fn), window: { app_event: { on: (name, fn) => events.set(name, fn), off: name => events.delete(name) } } }).default
 use()
 return { calls, state, emit: (name, ...args) => events.get(name)(...args), unmount: () => unmount(),
 tick: (seconds = 1, wall = 1000) => { position += seconds; time += wall; interval() }, seek: p => { events.get("setProgress")(p); position = p } }
}
test("实际播放五秒即上报一次，暂停与拖动不累计虚假时长", async () => {
 const h = harness(); h.emit("playerPlaying"); h.tick(4, 4000); assert.equal(h.calls.length, 0)
 h.seek(100); h.tick(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].playedSeconds, 5)
 h.tick(); h.emit("playerPause"); await Promise.resolve(); h.emit("playerEnded"); assert.equal(h.calls.length, 1)
 h.unmount()
 const paused = harness(); paused.emit("playerPlaying"); paused.tick(2, 2000); paused.emit("playerPause"); paused.tick(20, 20000)
 assert.equal(paused.calls.length, 0); paused.emit("playerPlaying"); paused.tick(3, 3000); assert.equal(paused.calls.length, 1); paused.unmount()
})
test("切歌后旧解析身份不能给新歌上报", () => {
 const h = harness(); h.emit("playerPlaying"); h.tick(3, 3000); h.emit("musicToggled")
 h.state.playMusicInfo.musicInfo = { ...track(), id: "b" }; h.emit("playerPlaying"); h.tick(8, 8000); assert.equal(h.calls.length, 0)
 h.state.playbackSourceInfo.value = route({ musicKey: "wy:b", reportIdentity: identities.originalReportIdentity(track("wy", "456", "78")) })
 h.emit("playerPlaying"); h.tick(5, 5000); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].songId, "456")
 h.unmount()
})

test("当前曲先更新但切歌事件尚未到达时，不把新曲进度累计给旧曲", () => {
 const h = harness(); h.emit("playerPlaying"); h.tick(3, 3000)
 h.state.playMusicInfo.musicInfo = { ...track(), id: "b" }
 h.tick(8, 8000); h.emit("playerPause"); assert.equal(h.calls.length, 0)
 h.unmount()
})
