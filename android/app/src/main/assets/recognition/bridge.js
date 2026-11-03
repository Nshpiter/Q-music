/* 本地指纹桥接：无网络访问，不保存 PCM，不把录音传给网页服务。 */
/* global AudioFingerprintRuntime */
(function() {
  const send = data => window.ReactNativeWebView.postMessage(JSON.stringify(data))
  let runtime; let monitor; let working = false
  const timeout = setTimeout(() => {
    clearInterval(monitor)
    send({ type: 'error', code: 'recognition_engine_error' })
  }, 12000)
  try {
    runtime = AudioFingerprintRuntime()
    monitor = setInterval(() => {
      if (typeof runtime.ExtractQueryFP !== 'function') return
      clearInterval(monitor); clearTimeout(timeout)
      send({ type: 'ready' })
    }, 10)
  } catch (_) { clearTimeout(timeout); send({ type: 'error', code: 'recognition_engine_error' }) }
  window.fingerprint = function(job) {
    if (!runtime || working || !Number.isInteger(job.id) || typeof job.pcm !== 'string' || job.pcm.length > 130000) return
    working = true
    let vector
    try {
      const binary = atob(job.pcm)
      if (binary.length % 2 || binary.length < 48000 || binary.length > 96000) throw new Error('Invalid sample')
      const pcm = new Float32Array(binary.length / 2)
      for (let i = 0; i < pcm.length; i++) {
        const value = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8)
        pcm[i] = (value > 32767 ? value - 65536 : value) / 32768
      }
      vector = runtime.ExtractQueryFP(pcm.buffer)
      let bytes = ''
      for (let i = 0; i < vector.size(); i++) bytes += String.fromCharCode(vector.get(i) & 255)
      send({ type: 'fingerprint', id: job.id, value: btoa(bytes) })
    } catch (_) { send({ type: 'error', id: job.id, code: 'recognition_engine_error' }) } finally { if (vector) vector.delete(); working = false }
  }
})()
