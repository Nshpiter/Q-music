// 使用 QQ 互联的官方网页授权入口，让服务端生成签名和 ptlogin 参数。
// 100497308 是互联 client_id，不能直接当作 ptlogin 的 appid。
const qqRedirect = 'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F'
export const LOGIN_URLS = {
  tx: `https://graph.qq.com/oauth2.0/authorize?client_id=100497308&redirect_uri=${encodeURIComponent(qqRedirect)}&response_type=code&scope=all&display=mobile`,
  wy: 'https://music.163.com/m/login',
} as const

export const QQ_CALLBACK = 'qmusic://account/qq?url='
export const QQ_RETURN = 'qmusic://account/qq'

export const isQQCallback = (url: string) => url == QQ_RETURN || url.startsWith(QQ_CALLBACK)

export const getQQCallbackUrl = (url: string): string | null => {
  if (!url.startsWith(QQ_CALLBACK)) return null
  let target = url.slice(QQ_CALLBACK.length)
  try {
    if (!target.startsWith('https://')) target = decodeURIComponent(target)
  } catch { return null }
  // 回跳只能继续 QQ 官方 HTTPS 页面，不接受其他站点、用户信息或自定义协议。
  return /^https:\/\/(?:[a-z0-9-]+\.)*qq\.com(?::443)?(?:[/?#]|$)/i.test(target) && !/[\s\\]/.test(target) ? target : null
}

export const getLoginAppUrl = (url: string, provider: 'tx' | 'wy'): string | null => {
  if (provider == 'wy' && /^orpheus:\/\//i.test(url)) return url
  if (!/^wtloginmqq:\/\/ptlogin\/qlogin\?/i.test(url)) return null
  // 二维码授权由原 WebView 轮询结果，回跳只负责唤醒应用，不携带登录凭证。
  // 兼容其他平台的旧式直跳，但 QQ 音乐不再依赖客户端交还临时登录 URL。
  const withoutCallback = url.replace(/([?&])schemacallback=[^&]*/ig, '$1').replace(/&&+/g, '&').replace(/[?&]$/, '')
  return `${withoutCallback}&schemacallback=${encodeURIComponent(/[?&]qrcode=/.test(url) ? QQ_RETURN : QQ_CALLBACK)}`
}
