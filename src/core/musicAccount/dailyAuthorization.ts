export const QQ_DAILY_PAGE = 'https://y.qq.com/n/ryqq_v2/qqmusic_skills'
// QQ 音乐对移动 UA 返回 App 下载页，API Key 只在桌面版 Skills 页面提供。
export const QQ_DAILY_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
// 只接收 QQ 音乐页面发来的凭证；授权页使用独立 WebView，不修改已有登录链路。
export const isQQDailyOrigin = (url: string) => /^https:\/\/(?:y|a)\.qq\.com(?::443)?(?:[/?#]|$)/i.test(url) && !/[\s\\]/.test(url)
export const QQ_DAILY_BRIDGE = `(() => {
  if (!/^https:\\/\\/(?:y|a)\\.qq\\.com(?::443)?(?:[/?#]|$)/i.test(location.href)) return;
  if (window.__qmusicDailyTimer) return;
  let previous = '';
  const inspect = () => {
    const values = [document.body?.innerText || '', ...Array.from(document.querySelectorAll('input,textarea')).map(element => element.value || '')];
    const key = values.join('\\n').match(/\\bqmk-[A-Za-z0-9_-]{12,1024}\\b/)?.[0];
    if (key && previous !== key) {
      previous = key;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'qq-daily-key', key }));
    }
  };
  window.__qmusicDailyTimer = setInterval(inspect, 1200);
  inspect();
})(); true;`
