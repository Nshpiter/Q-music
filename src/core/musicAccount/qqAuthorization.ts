// 使用官方页面的二维码会话完成同机授权：QQ 确认后，由原 WebView 轮询并写入 Cookie。
// 不修改 OAuth redirect_uri，不在外部浏览器与应用之间搬运 Cookie 或授权凭证。
// 新版 Android WebView 的消息来源是 origin（没有尾部 /），旧版则传完整 URL。
export const isQQLoginPage = (url: string) => /^https:\/\/(?:ssl|xui)\.ptlogin2\.qq\.com(?::443)?(?:\/|$)/i.test(url)

export const QQ_AUTH_BRIDGE = `
(function () {
  if (location.protocol !== 'https:' || !/^(ssl|xui)\\.ptlogin2\\.qq\\.com$/.test(location.hostname)) return;
  if (window.__qmusicQQ) return;
  var pt = window.pt;
  if (!pt || !pt.qrcode || typeof pt.qrcode.get !== 'function' || typeof pt.qrcode.polling !== 'function') return;
  var qr = pt.qrcode;
  var poll = qr.polling;
  var pending = false;
  var expiry;
  function send(type, url) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, url: url }));
  }
  function stop() {
    pending = false;
    clearTimeout(expiry);
    clearInterval(qr.clock);
  }
  qr.polling = function (ticket) {
    // 取消/超时后到达的二维码响应不能再拉起 QQ 或浏览器；普通扫码仍可轮询。
    if (!pending) { if (!ticket) return poll.apply(this, arguments); return; }
    // 不调用官方打开浏览器的分支；保留原有签名、qrsig 和 OAuth 轮询逻辑。
    poll.call(this);
    if (ticket) send('qq-open', 'wtloginmqq://ptlogin/qlogin?qrcode=' + encodeURIComponent(ticket));
  };
  window.__qmusicQQ = {
    start: function () {
      if (pending) return;
      pending = true;
      send('qq-pending');
      expiry = setTimeout(function () { stop(); send('qq-expired'); }, 120000);
      try { qr.get(1); } catch (error) { stop(); send('qq-unavailable'); }
    },
    resume: function () { if (pending && !qr.done) poll.call(qr); },
    stop: stop
  };
  function startFromButton(event) {
    var button = event.target && event.target.closest && event.target.closest('#onekey');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.__qmusicQQ.start();
  }
  // 官方移动页绑定 touchstart；仅拦截 click 会晚于官方的浏览器直跳。
  document.addEventListener(pt.clickEvent || 'click', startFromButton, { capture: true, passive: false });
  if (pt.clickEvent && pt.clickEvent !== 'click') document.addEventListener('click', startFromButton, true);
  window.addEventListener('pagehide', stop);
})(); true;
`

export const QQ_START_AUTH = `${QQ_AUTH_BRIDGE}
if (window.__qmusicQQ) window.__qmusicQQ.start();
else window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'qq-unavailable' }));
true;`

export const QQ_RESUME_AUTH = 'if (window.__qmusicQQ) window.__qmusicQQ.resume(); true;'
export const QQ_STOP_AUTH = 'if (window.__qmusicQQ) window.__qmusicQQ.stop(); true;'
