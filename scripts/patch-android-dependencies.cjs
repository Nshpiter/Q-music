// 固定版本原生依赖的兼容补丁，安装依赖及本地构建前执行，避免只修改 node_modules。
const fs = require('node:fs')
const path = require('node:path')

function patch(relative, before, after) {
  const file = path.join(__dirname, '..', 'node_modules', relative)
  const source = fs.readFileSync(file, 'utf8')
  const normalized = source.replace(/\r\n/g, '\n')
  if (normalized.includes(after)) return
  if (!normalized.includes(before)) throw new Error(`原生依赖已变化，请重新检查补丁：${relative}`)
  const result = normalized.replace(before, after)
  fs.writeFileSync(file, source.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result)
}

// RN 0.73 的插件把 Gradle 8.11+ 的 API 弃用警告当成错误；只解除该插件的警告升级。
patch('@react-native/gradle-plugin/build.gradle.kts',
  '    allWarningsAsErrors = true',
  '    allWarningsAsErrors = false // Q-music: Gradle 8.11 compatibility')

// 系统再次 startService 时不能重建 MusicManager，否则旧播放实例与绑定对象脱节。
patch('react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java',
  '        manager = new MusicManager(this);\n        handler = new Handler();',
  '        if (manager == null) {\n            manager = new MusicManager(this);\n            handler = new Handler();\n        }')

const metadataManager = 'react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'
// target 31+ 必须声明 PendingIntent 的可变性；打开播放器不需要可变 Intent。
patch(metadataManager,
  'PendingIntent.getActivity(context, 0, openApp, PendingIntent.FLAG_CANCEL_CURRENT)',
  'PendingIntent.getActivity(context, 0, openApp, PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE)')

// 同时支持播放/暂停时声明切换语义，供系统媒体卡及耳机按键使用。
patch(metadataManager,
  '        pb.setActions(actions);',
  '        long sessionActions = actions;\n' +
  '        if ((actions & PlaybackStateCompat.ACTION_PLAY) != 0 && (actions & PlaybackStateCompat.ACTION_PAUSE) != 0) {\n' +
  '            sessionActions |= PlaybackStateCompat.ACTION_PLAY_PAUSE;\n' +
  '        }\n' +
  '        pb.setActions(sessionActions);')

// 暂停状态的预加载在播放器内叫 CONNECTING；系统媒体卡会把它当成播放中。
// 媒体会话单独归一为 PAUSED，并停止进度外推，保留 JS 的加载事件语义。
patch(metadataManager,
  '        pb.setState(playback.getState(), playback.getPosition(), playback.getRate());',
  '        int sessionState = playback.getState();\n' +
  '        if (sessionState == PlaybackStateCompat.STATE_CONNECTING) sessionState = PlaybackStateCompat.STATE_PAUSED;\n' +
  '        float sessionSpeed = sessionState == PlaybackStateCompat.STATE_PLAYING ? playback.getRate() : 0f;\n' +
  '        pb.setState(sessionState, playback.getPosition(), sessionSpeed);')

// 曲目信息可能跨桥延迟到达，通知按钮必须取原生此刻的状态，不采用旧 JS 快照。
patch(metadataManager,
  '        updatePlayback(isPlaying);',
  '        updatePlayback(Utils.isPlaying(playback.getState()));')
