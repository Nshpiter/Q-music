// 酷狗官方扫码与账号歌单协议，接口字段参考 MakcRe/KuGouMusicApi（MIT）。
// 仅请求酷狗 HTTPS 服务；凭证由各端安全存储，不交给第三方 API 服务。
export interface KugouSession { userId: string, token: string, mid: string, nickname: string, avatar: string }
export interface KugouQr { key: string, image: string, mid: string, expiresAt: number }
export interface KugouPlaylist { id: string, name: string, cover: string, count: number, kind: 'created' | 'favorite' }
type Row = Record<string, any>
type Fetch = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>
const fail = (reason = 'unavailable'): never => { throw new Error(reason) }
const numericId = (value: unknown) => /^\d+$/.test(String(value ?? '')) && !/^0+$/.test(String(value)) ? String(value) : ''
const imageUrl = (value: unknown) => {
  const url = String(value ?? '').replace('{size}', '240')
  return /^https:\/\//i.test(url) ? url : /^http:\/\//i.test(url) ? url.replace(/^http:/i, 'https:') : ''
}
export const parseKugouSession = (value: unknown): KugouSession | null => {
  if (!value || typeof value != 'object') return null
  const row = value as Row
  if (!numericId(row.userId) || typeof row.token != 'string' || !row.token || row.token.length > 4096 ||
    typeof row.mid != 'string' || !/^[a-f0-9]{32}$/i.test(row.mid)) return null
  return { userId: String(row.userId), token: row.token, mid: row.mid, nickname: String(row.nickname ?? ''), avatar: imageUrl(row.avatar) }
}

export const createKugouApi = (fetcher: Fetch, md5: (value: string) => string) => {
  const call = async(path: string, params: Row, body: Row | undefined, mid: string, signal?: AbortSignal, login = false, router = 'cloudlist.service.kugou.com'): Promise<Row> => {
    const query: Row = { dfid: '-', mid, uuid: '-', appid: 1005, clientver: 20489, clienttime: Math.floor(Date.now() / 1000), ...params }
    const text = body ? JSON.stringify(body) : ''
    const salt = login ? 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt' : 'OIlwieks28dk2k092lksi2UIkp'
    query.signature = md5(salt + Object.keys(query).sort().map(key => `${key}=${query[key]}`).join('') + text + salt)
    const origin = login ? 'https://login-user.kugou.com' : 'https://gateway.kugou.com'
    const controller = new AbortController()
    const abort = () => { controller.abort() }
    signal?.addEventListener('abort', abort)
    if (signal?.aborted) abort()
    const timer = setTimeout(abort, 12_000)
    try {
      const response = await fetcher(`${origin}${path}?${new URLSearchParams(query).toString()}`, {
        method: body ? 'POST' : 'GET',
        credentials: 'omit',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', dfid: '-', mid, clienttime: String(query.clienttime), ...(login ? {} : { 'x-router': router }) },
        ...(body ? { body: text } : {}),
      })
      if (!response.ok) fail(response.status == 401 ? 'login_required' : 'unavailable')
      const result = await response.json()
      const code = result.error_code ?? result.errcode
      if (Number(code) == 20028) fail('verification_required')
      if (Number(result.status) != 1 || (code != null && Number(code) != 0) || !result.data) {
        // 部分接口以 HTTP 200 返回登录过期，只提取状态，不将原始响应或凭证交给界面。
        const message = String(result.error_msg ?? result.errmsg ?? result.msg ?? result.message ?? '')
        if (/未登录|未登陆|重新登[录陆]|登[录陆].*(?:失效|过期)|(?:token|session).*(?:expired|invalid)|(?:expired|invalid).*(?:token|session)/i.test(message)) fail('login_required')
        fail()
      }
      return result.data
    } catch (error) {
      // 底层异常可能携带含 token 的请求 URL，不透传给日志或 UI。
      if (signal?.aborted) fail('cancelled')
      if (error instanceof Error && ['login_required', 'verification_required'].includes(error.message)) fail(error.message)
      return fail()
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }

  const createQr = async(signal?: AbortSignal): Promise<KugouQr> => {
    // mid 是设备关联标识，不作为认证密钥。
    const mid = md5(`${Date.now()}-${Math.random()}`)
    const data = await call('/v2/qrcode', { type: 1, plat: 4, srcappid: 2919, qrcode_txt: 'https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=1005&' }, undefined, mid, signal, true)
    if (typeof data.qrcode != 'string' || !data.qrcode ||
      typeof data.qrcode_img != 'string' || !/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(data.qrcode_img)) fail()
    return { key: data.qrcode, image: data.qrcode_img, mid, expiresAt: Date.now() + 120_000 }
  }

  const checkQr = async(qr: KugouQr, signal?: AbortSignal): Promise<{ status: 'waiting' | 'scanned' | 'expired' | 'connected', session?: KugouSession }> => {
    if (Date.now() >= qr.expiresAt) return { status: 'expired' }
    const data = await call('/v2/get_userinfo_qrcode', { plat: 4, srcappid: 2919, qrcode: qr.key }, undefined, qr.mid, signal, true)
    if (Number(data.status) == 0) return { status: 'expired' }
    if (Number(data.status) == 1) return { status: 'waiting' }
    if (Number(data.status) == 2) return { status: 'scanned' }
    if (Number(data.status) != 4) return fail()
    const session = parseKugouSession({ userId: data.userid, token: data.token, mid: qr.mid, nickname: data.nickname, avatar: data.pic ?? data.picurl })
    if (!session) return fail()
    return { status: 'connected', session }
  }

  const getPlaylists = async(session: KugouSession, signal?: AbortSignal): Promise<KugouPlaylist[]> => {
    const lists: KugouPlaylist[] = []
    const seen = new Set<string>()
    for (let page = 1; page <= 1000; page++) {
      const data = await call('/v7/get_all_list', { plat: 1, userid: session.userId, token: session.token },
        { userid: session.userId, token: session.token, total_ver: 979, type: 2, page, pagesize: 100 }, session.mid, signal)
      const rows: Row[] = data.info ?? data.list
      if (!Array.isArray(rows)) fail()
      for (const row of rows) {
        const id = numericId(row.listid ?? row.list_id)
        if (!id || seen.has(id)) fail('incomplete')
        seen.add(id)
        lists.push({
          id,
          name: String(row.name ?? row.listname ?? '未命名歌单'),
          cover: imageUrl(row.pic ?? row.img ?? row.picurl),
          count: Number(row.count ?? row.songcount ?? row.filecount ?? 0),
          kind: Number(row.is_collect) == 1 || (numericId(row.list_create_userid) && String(row.list_create_userid) != session.userId) ? 'favorite' : 'created',
        })
      }
      const total = Number(data.total ?? data.count)
      if (Number.isFinite(total) && total >= 0) {
        if (lists.length > total) fail('incomplete')
        if (lists.length == total) return lists
        if (!rows.length) fail('incomplete')
      } else if (rows.length < 100) return lists
    }
    return fail('incomplete')
  }

  const getPlaylistHashes = async(session: KugouSession, id: string, signal?: AbortSignal): Promise<string[]> => {
    if (!numericId(id)) fail()
    const hashes: string[] = []
    const seen = new Set<string>()
    const pages = new Set<string>()
    let expected: number | undefined
    for (let page = 1; page <= 1000; page++) {
      const data = await call('/v4/get_list_all_file_v3', { userid: session.userId, token: session.token },
        { listid: id, userid: session.userId, token: session.token, type: 0, page, pagesize: 300, area_code: 1, allplatform: 1, show_cover: 1 }, session.mid, signal)
      const rows: Row[] = data.info ?? data.list
      if (!Array.isArray(rows)) fail()
      // 接口忽略 page 或重复返回整页时，不能误将重复页计入总数后覆盖本地歌单。
      const pageKey = md5(JSON.stringify(rows.map(row => row.hash ?? row.filehash ?? row.file_hash)))
      if (rows.length && pages.has(pageKey)) fail('incomplete')
      pages.add(pageKey)
      const rawTotal = data.count ?? data.total
      if (rawTotal != null) {
        const total = Number(rawTotal)
        if (!Number.isInteger(total) || total < 0 || (expected != null && total != expected)) fail('incomplete')
        expected = total
      }
      for (const row of rows) {
        const hash = String(row.hash ?? row.filehash ?? row.file_hash ?? '').toUpperCase()
        if (!/^[A-F0-9]{32}$/.test(hash)) fail('incomplete')
        // 同一歌曲允许出现在歌单多次，分页完成后再去重。
        hashes.push(hash)
        seen.add(hash)
      }
      if (expected != null && hashes.length >= expected) {
        if (hashes.length != expected) fail('incomplete')
        return [...seen]
      }
      // 服务端可能限制每页数量；已知总数时不能把短页当成末页。
      if (!rows.length || (expected == null && rows.length < 300)) {
        if (expected != null && hashes.length != expected) fail('incomplete')
        return [...seen]
      }
    }
    return fail('incomplete')
  }
  const getDailyHashes = async(session: KugouSession, signal?: AbortSignal): Promise<string[]> => {
    const data = await call('/everyday_song_recommend', { userid: session.userId, token: session.token },
      { platform: 'android', userid: session.userId }, session.mid, signal, false, 'everydayrec.service.kugou.com')
    if (!Array.isArray(data.song_list)) fail()
    const hashes = data.song_list.map((row: Row) => String(row.hash ?? row.hash_128 ?? '').toUpperCase()) as string[]
    if (hashes.some(hash => !/^[A-F0-9]{32}$/.test(hash))) fail('incomplete')
    return [...new Set(hashes)].slice(0, 30)
  }
  return { createQr, checkQr, getPlaylists, getPlaylistHashes, getDailyHashes }
}
