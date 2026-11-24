const { test } = require('node:test')
const assert = require('node:assert/strict')
const { deflateSync, brotliCompressSync } = require('node:zlib')
const { createServer } = require('node:net')
const { once } = require('node:events')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

test('插件歌词查询合并并发请求，失败后可重试且不携带账号凭证', async() => {
  const { publicLyrics } = await import('../src/main/modules/betterPlugins/neteaseLyrics.js')
  let calls = 0
  const fetch = async(url, options) => {
    calls++
    assert.equal(new URL(url).searchParams.get('id'), '90012345')
    assert.equal(options.credentials, 'omit')
    if (calls === 1) return { ok: false }
    return { ok: true, json: async() => ({ code: 200, lrc: { lyric: 'fixture' }, ignored: 'unused' }) }
  }
  await assert.rejects(publicLyrics('../secret', fetch), /invalid_song_id/)
  await assert.rejects(publicLyrics('90012345', fetch), /lyrics_unavailable/)
  const [first, second] = await Promise.all([publicLyrics('90012345', fetch), publicLyrics(90012345, fetch)])
  assert.deepEqual(first, second)
  assert.equal(first.lrc.lyric, 'fixture')
  assert(!('ignored' in first))
  await publicLyrics('90012345', fetch)
  assert.equal(calls, 2)
})

test('直播协议区分授权通过与拒绝，并解开压缩弹幕', async() => {
  const { livePacket, readLivePackets } = await import('../src/common/utils/liveRequests.js')
  const events = []
  const collect = (op, data) => events.push([op, data])
  for (const code of [0, -101]) readLivePackets(livePacket(8, { code }), collect)
  const message = { cmd: 'DANMU_MSG', info: [[], '点歌 test'] }
  for (const [version, compress] of [[2, deflateSync], [3, brotliCompressSync]]) {
    const head = livePacket(5)
    const body = compress(livePacket(5, message))
    head.writeUInt32BE(body.length + 16)
    head.writeUInt16BE(version, 6)
    readLivePackets(Buffer.concat([head, body]), collect)
  }
  assert.deepEqual(events, [[8, { code: 0 }], [8, { code: -101 }], [5, message], [5, message]])
  assert.throws(() => readLivePackets(Buffer.alloc(16), collect))
})

test('直播点歌保留收到顺序，去重，换房时丢弃在途结果', async() => {
  const { createRequestQueue } = await import('../src/common/utils/liveRequests.js')
  const control = new AbortController()
  const requests = []
  const played = []
  const queue = createRequestQueue(keyword => new Promise(resolve => requests.push([keyword, resolve])), hit => played.push(hit), assert.fail, () => 3, control.signal)
  queue('点歌 A'); queue('pl B'); queue('点歌 A'); queue('普通弹幕')
  assert.deepEqual(requests.map(row => row[0]), ['A'])
  requests[0][1]('first')
  await new Promise(setImmediate)
  assert.deepEqual(requests.map(row => row[0]), ['A', 'B'])
  control.abort()
  requests[1][1]('old room')
  await new Promise(setImmediate)
  assert.deepEqual(played, ['first'])
})

test('VocaDB 把同名同歌手排在前面，仅保留有效原作链接', async() => {
  const { queryVocaDb } = await import('../src/common/utils/vocaDb.ts')
  const rows = [{ id: 7, name: 'Test', artistString: 'Other' }, { id: 9, name: 'Ｔｅｓｔ', artistString: 'Miku', pvs: [{ pvType: 'Original', service: 'Youtube', pvId: 'abcdefghijk' }, { pvType: 'Original', service: 'Youtube', pvId: 'bad' }] }]
  const result = await queryVocaDb('test', 'Miku', new AbortController().signal, async() => ({ ok: true, json: async() => ({ items: rows }) }))
  assert.deepEqual(result.map(row => row.id), [9, 7])
  assert.deepEqual(result[0].videos.map(row => row.url), ['https://www.youtube.com/watch?v=abcdefghijk'])
  await assert.rejects(queryVocaDb('test', '', new AbortController().signal, async() => ({ ok: false, status: 403 })), /403/)
})

test('近七日酷狗新碟处理边界和重复发行', async() => {
  const { recentHoyoAlbums } = await import('../src/common/utils/hoyoReleases.ts')
  const row = { albumid: 1, albumname: 'OST', publish_time: '2026-10-10' }
  const now = Date.parse('2026-10-11T00:00:00+08:00')
  assert.deepEqual(recentHoyoAlbums({ data: [row, row, { ...row, albumid: 2, publish_time: '2026-10-04' }] }, now).map(row => row.id), ['1'])
  assert.throws(() => recentHoyoAlbums({}))
})

test('Discord 本地管道处理分片握手、活动与关闭', { timeout: 8000 }, async() => {
  const { discordPresence } = await import('../src/common/utils/discordPresence.js')
  const endpoint = process.platform === 'win32' ? '\\\\.\\pipe\\q-music-discord-test-' + process.pid : join(tmpdir(), 'q-discord-' + process.pid + '.sock')
  const server = createServer()
  server.listen(endpoint)
  await once(server, 'listening')
  const connection = once(server, 'connection')
  const states = []
  const rpc = discordPresence('123456789012345678', state => states.push(state), () => require('node:net').createConnection(endpoint))
  const [peer] = await connection
  try {
    rpc.set({ type: 2, details: 'Fixture' })
    const [handshake] = await once(peer, 'data')
    assert.equal(handshake.readUInt32LE(), 0)
    assert.equal(JSON.parse(handshake.subarray(8)).client_id, '123456789012345678')
    const data = Buffer.from('{"evt":"READY"}')
    const header = Buffer.alloc(8)
    header.writeUInt32LE(1, 0); header.writeUInt32LE(data.length, 4)
    peer.write(header.subarray(0, 3))
    peer.write(Buffer.concat([header.subarray(3), data]))
    const [activity] = await once(peer, 'data')
    assert.equal(JSON.parse(activity.subarray(8)).args.activity.details, 'Fixture')
    const clear = once(peer, 'data')
    rpc.close()
    assert.equal(JSON.parse((await clear)[0].subarray(8)).args.activity, null)
    assert(states.includes('receiver_connected'))
  } finally {
    peer.destroy()
    server.close()
  }
})

test('插件清单、ZIP 路径和依赖顺序使用同一规则', async() => {
  const { readBetterPackage, pluginOrder } = await import('../src/common/utils/betterPackage.js')
  const { zipSync, strToU8 } = require('fflate')
  const pack = (file, extra = {}) => zipSync({
    './pkg/manifest.json': strToU8(JSON.stringify({ name: 'Test', injects: { Main: [{ file }] } })),
    './pkg/main.js': strToU8(''),
    ...extra,
  })
  assert.deepEqual(readBetterPackage(pack('./main.js')).scripts, ['main.js'])
  for (const path of ['../main.js', '/main.js', 'C:/main.js', 'a//main.js']) assert.throws(() => readBetterPackage(pack(path)), /plugin_format/)
  assert.throws(() => readBetterPackage(pack('main.js', { 'pkg/main.js': new Uint8Array() })), /plugin_format/)
  const lib = { id: 'Library', requirements: ['LibSongInfo'] }
  const item = { id: 'Root', requirements: ['library', 'Library'] }
  assert.deepEqual(pluginOrder(item, [item, lib]), [lib, item])
  assert.throws(() => pluginOrder(item, [item]), /plugin_dependency: library/)
  assert.throws(() => pluginOrder(item, [item, { ...lib, requirements: ['Root'] }]), /plugin_cycle/)
})

test('插件目录按依赖安装，校验实际包名和下载来源', async() => {
  const { loadCatalog, downloadPluginTree } = await import('../src/main/modules/betterPlugins/catalog.js')
  const { zipSync, strToU8 } = require('fflate')
  const rows = [{ slug: 'app', requirements: ['lib'], 'file-url': 'app.plugin' }, { slug: 'lib', 'file-url': 'lib.plugin' }, { slug: 'escape', 'file-url': '../escape.plugin' }]
  const calls = []
  const fetch = async url => {
    calls.push(url)
    if (url.endsWith('plugins.json')) return Response.json(rows)
    const slug = url.endsWith('app.plugin') ? 'app' : 'lib'
    return new Response(zipSync({ 'manifest.json': strToU8(JSON.stringify({ name: slug, requirements: slug === 'lib' ? [] : ['lib'], injects: { Main: [{ file: 'main.js' }] } })), 'main.js': new Uint8Array() }))
  }
  const catalog = await loadCatalog(fetch, 'https://example.org/source')
  assert.deepEqual([...catalog.keys()], ['app', 'lib'])
  assert.deepEqual((await downloadPluginTree(fetch, catalog, 'App', [])).map(p => p.id), ['lib', 'app'])
  assert.deepEqual(calls.slice(1), ['https://example.org/source/lib.plugin', 'https://example.org/source/app.plugin'])
  catalog.get('lib').url = catalog.get('app').url
  await assert.rejects(downloadPluginTree(fetch, catalog, 'app', []), /plugin_format/)
})
