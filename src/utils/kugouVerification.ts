// 酷狗验证协议参考 MakcRe/KuGouMusicApi（MIT）。这是公开的服务端 RSA 公钥。
export const KUGOU_VERIFY_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIAG7QOELSYoIJvTFJhMpe1s/gbjDJX51HBNnEl5HXqTW6lQ7LC8jr9fWZTwusknp+sVGzwd40MwP6U5yDE27M/X1+UR4tvOGOqp94TJtQ1EPnWGWXngpeIW5GxoQGao1rmYWAu6oi1z9XkChrsUdC6DJE5E221wf/4WLFxwAtRQIDAQAB\n-----END PUBLIC KEY-----'

export const parseKugouCaptchaMessage = (text: string): { ticket: string, randstr: string } | null => {
  if (text.length > 12000) return null
  try {
    const data = JSON.parse(text)
    if (data.ret !== 0 || typeof data.ticket != 'string' || !data.ticket || data.ticket.length > 8192 || typeof data.randstr != 'string' || !data.randstr || data.randstr.length > 1024) return null
    return { ticket: data.ticket, randstr: data.randstr }
  } catch { return null }
}

// 仅接受应用 ID，不能把 token、账号或验证 eventid 放进第三方验证码页面。
export const createKugouCaptchaHtml = (appId: string) => {
  if (!/^\d{4,32}$/.test(appId)) throw new Error('verification_unsupported')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; worker-src blob:; script-src 'unsafe-inline' https://*.qcloud.com https://*.qq.com https://*.gtimg.com; style-src 'unsafe-inline' https://*.qcloud.com https://*.qq.com https://*.gtimg.com; frame-src https://*.qcloud.com https://*.qq.com; connect-src https://*.qcloud.com https://*.qq.com https://*.gtimg.com; img-src data: blob: https://*.qcloud.com https://*.qq.com https://*.gtimg.com">
<title>酷狗安全验证</title><style>body{margin:0;background:#f8fafb;color:#25313c;font:15px system-ui;text-align:center;padding:36px 20px}h1{font-size:21px}p{font-size:14px;line-height:1.7;color:#5b6670}button{border:0;border-radius:14px;background:#e3edf7;color:#245480;padding:14px 24px;font-size:15px;cursor:pointer}button:disabled{opacity:.5}</style></head>
<body><h1>酷狗安全验证</h1><p>请完成下方验证。完成后会核对收藏状态，<br>不会自动重复提交收藏。</p><p id="status" role="status">正在加载官方验证码…</p><button id="retry" disabled onclick="start()">重新打开验证码</button>
<script>
var captcha, finished=false, timer;
function report(value){if(finished)return;finished=true;clearTimeout(timer);var text=JSON.stringify(value);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(text);else window.open('qmusic-captcha://result?data='+encodeURIComponent(text));}
function start(){if(finished)return;if(!window.TencentCaptcha){document.getElementById('status').textContent='验证码加载失败，请关闭后重试';return;}try{captcha=new TencentCaptcha('${appId}',function(res){if(res.ret===0){document.getElementById('status').textContent='正在核验…';report({ret:0,ticket:res.ticket,randstr:res.randstr});}else{document.getElementById('status').textContent='验证已取消，可以重新打开';}},{showHeader:false});captcha.show();document.getElementById('status').textContent='请按验证码提示操作';}catch(e){document.getElementById('status').textContent='验证码暂时无法打开，请关闭后重试';}}
timer=setTimeout(function(){document.getElementById('status').textContent='加载时间较长，可关闭后重试';},15000);
</script><script src="https://turing.captcha.qcloud.com/TCaptcha.js" onload="clearTimeout(timer);document.getElementById('retry').disabled=false;start()" onerror="clearTimeout(timer);document.getElementById('status').textContent='验证码加载失败，请关闭后重试'"></script></body></html>`
}
