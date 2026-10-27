// 使用 QQ 互联的官方网页授权入口，让服务端生成签名和 ptlogin 参数。
// 100497308 是互联 client_id，不能直接当作 ptlogin 的 appid。
const qqRedirect = 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F'
export const LOGIN_URLS = {
  kg: 'https://www.kugou.com/',
  tx: `https://graph.qq.com/oauth2.0/authorize?client_id=100497308&redirect_uri=${encodeURIComponent(qqRedirect)}&response_type=code&scope=all&display=mobile`,
  wy: 'https://music.163.com/m/login',
} as const

// 通过 QQ 音乐官方回调在当前 WebView 写入微信账号 Cookie，不跳到外部浏览器。
// appid 是 QQ 音乐公开的微信 OAuth 应用标识，不是 App Secret，也不是用户的密钥。
const wechatRedirect = 'https://y.qq.com/portal/wx_redirect.html?login_type=2&surl=https://y.qq.com/'
export const QQ_WECHAT_LOGIN_URL = `https://open.weixin.qq.com/connect/qrconnect?appid=wx48db31d50e334801&redirect_uri=${encodeURIComponent(wechatRedirect)}&response_type=code&scope=snsapi_login&state=STATE`

export const QQ_CALLBACK = 'qmusic://account/qq?url='
export const QQ_RETURN = 'qmusic://account/qq'

export const isQQCallback = (url: string) => url == QQ_RETURN || url.startsWith(QQ_CALLBACK)

// 网易官方 OAuth 仍可能返回 HTTP 回调；在原 WebView 内升级 HTTPS 后完成 Cookie 写入。
export const normalizeLoginNavigation = (url: string, provider: 'tx' | 'wy' | 'kg') => {
  if (provider == 'wy' && /^http:\/\/(?:music|y\.music)\.163\.com\/back\/(?:qq|weixin)(?:[/?#]|$)/i.test(url) && !/[\s\\]/.test(url)) return url.replace(/^http:/i, 'https:')
  return url
}

export const getQQCallbackUrl = (url: string, provider: 'tx' | 'wy' | 'kg' = 'tx'): string | null => {
  if (!url.startsWith(QQ_CALLBACK)) return null
  let target = url.slice(QQ_CALLBACK.length)
  try {
    if (!target.startsWith('https://')) target = decodeURIComponent(target)
  } catch { return null }
  target = normalizeLoginNavigation(target, provider)
  // 网易云 QQ 授权也可能直接返回网易云回调；凭证始终由原 WebView 接收。
  const official = /^https:\/\/(?:[a-z0-9-]+\.)*qq\.com(?::443)?(?:[/?#]|$)/i.test(target) ||
    (provider == 'wy' && /^https:\/\/music\.163\.com(?::443)?(?:[/?#]|$)/i.test(target))
  return official && !/[\s\\]/.test(target) ? target : null
}

export const getLoginAppUrl = (url: string, provider: 'tx' | 'wy' | 'kg'): string | null => {
  if (provider == 'kg') return null
  if (provider == 'wy' && /^orpheus:\/\//i.test(url)) return url
  if (!/^wtloginmqq:\/\/ptlogin\/qlogin\?/i.test(url)) return null
  // 二维码授权由原 WebView 轮询结果，回跳只负责唤醒应用，不携带登录凭证。
  // 兼容其他平台的旧式直跳，但 QQ 音乐不再依赖客户端交还临时登录 URL。
  const withoutCallback = url.replace(/([?&])schemacallback=[^&]*/ig, '$1').replace(/&&+/g, '&').replace(/[?&]$/, '')
  return `${withoutCallback}&schemacallback=${encodeURIComponent(/[?&]qrcode=/.test(url) ? QQ_RETURN : QQ_CALLBACK)}`
}
