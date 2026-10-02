# 安卓后台播放与词幕接入

## 使用入口

- 设置 → 播放 → 后台播放：检查音乐通知、系统电池白名单，并打开系统应用设置。
- 状态栏歌词随播放器自动接入，不提供开关，也不读取旧预览版的关闭值。设置 → 播放 → 状态栏歌词（词幕）仅显示连接状态、帮助和重连入口。

厂商的“无限制／允许后台运行”与 Android 电池白名单可能不同。无法确认白名单不表示用户拒绝授权，也不会禁止音乐播放。锁屏后仍被系统中断时，可检查系统的后台运行与自启动设置。

## 原生歌词接口

直接依赖官方 `io.github.proify.lyricon:provider:0.1.70`，提供端集成在 Q-music APK 内，不需要另装 Q-music 适配插件，也不需要桌面歌词悬浮窗权限。

词幕本身需要按其项目说明安装、启用 LSPosed 的系统界面作用域。本接入针对 Lyricon Provider 接口，旧版 CSLyric 不使用此接口。

发送整首 LRC 时间轴、译文、罗马音及带单调时钟时间戳的播放状态。词幕按时间轴显示歌词，Q-music 不在后台逐行轮询；暂停、跳转、倍速、切歌和退出应用会同步更新，SDK 重连后恢复最近的快照。注册信息携带 64×64 的彩色 Q-music 图标；是否显示、显示位置由词幕的图标样式控制。

未安装词幕时只缓存当前播放快照，不发送注册广播；安装后返回应用会连接并同步。SDK 0.1.70 注册超时后不会自动重试，因此原生层增加最多三次退避重试。已连接、未安装、连接中、超时分别显示；日志只记录连接状态和歌词行数，不记录歌词内容。

- [词幕项目](https://github.com/tomakino/lyricon)
- [原生接入文档](https://github.com/tomakino/lyricon/blob/main/docs/zh-cn/developer/provider/quick-start.md)
- [Android Kotlin 字节码工具兼容表](https://developer.android.com/build/kotlin-support)

## 构建与回归

官方 SDK 的依赖要求 compile SDK 36，并包含 Kotlin 2.3 字节码，因此使用 AGP 8.13.2 / Gradle 8.13。target SDK 为 33，使 Android 13+ 使用 MediaSession 的播放/暂停、上一首、下一首语义布局，而不是旧通知按钮从左侧顺排。保留旧系统的三个通知动作，不添加空白占位按钮。

升级 target SDK 后，Android 11+ 的 WRITE_EXTERNAL_STORAGE 不再提供直接路径访问。现有公共音乐目录下载、云端文件导入及内置文件浏览器按需引导到“所有文件访问”设置并在返回后复查；在线播放和系统单文件选择器不申请此权限。Android 10 及以下沿用原存储权限。

`npm ci` 和 `scripts/run-gradle.js` 会执行版本受控的原生补丁：兼容旧 RN 构建插件在新 Gradle 下产生的弃用警告，防止播放服务重复启动时重建已有播放器，给通知入口添加不可变 PendingIntent，并补齐播放/暂停切换动作。补丁遇到不匹配的依赖源码会报错，不静默跳过。

运行 `node scripts/verify-background-playback.cjs` 验证权限往返、延迟生效、并发与失败恢复、保留取消文案、播放通知控制及词幕状态同步。standalone APK 同样启用 R8，用来验证混淆后的接入；包名后缀为 `.preview`，可与正式版共存。

本地编译及模拟边界回归不能代替特定厂商系统和词幕的真机测试。

## 上一轮预览包验证记录（background-lyrics）

- 121 条真实模块回归断言通过；源码 ESLint 通过（排除未跟踪的 `artifacts/` 抓取样本）。
- arm64 standalone 编译、R8 混淆、原生 lint 和 APK 签名校验通过。
- Android 36.1 模拟器安装升级并冷启动成功；实际授予通知权限和电池白名单后，返回应用均正确显示“已开启”。
- 未安装词幕时，开启、重新连接、关闭入口正常；本地 WAV 成功进入 MediaSession 的 PLAYING 状态，媒体能力不含 STOP。
- 模拟器在进一步后台测试时离线，未完成持续锁屏验证。OS 4 的长时间后台表现及已安装词幕后的状态栏显示仍需真机确认。

## 通知排版与自动接入修正（media-lyrics-fix）

- 用户日志显示小米 OS 4、Android 17；媒体数据中 `semanticActions=null`，旧 target 29 使系统使用从左侧顺排的通知动作。词幕安装及 System UI 作用域在日志中可见，用户随后确认尚未打开 Q-music 的旧开关。
- 取消歌词开关与设置字段，随播放器自动初始化；提供彩色应用图标、未安装/连接超时状态及有限重试。
- 136 条回归断言通过，包括旧开关为 false 时仍自动同步、未安装时保留快照、退出清理及 Android 29/30/33 存储权限分流。源码 ESLint 通过；全量 TypeScript 检查仍有既存错误，不能视为全量通过。
- 最终 arm64 包通过编译、R8、原生 lint、签名校验及模拟器覆盖安装。模拟器实测设置页不再有歌词开关，未安装词幕时正确显示状态，本地 WAV 正常播放。
- MediaSession 实测动作值 822，含播放/暂停切换、上一首、下一首及定位，不含 STOP。后台媒体键暂停后状态为 PAUSED，恢复后为 PLAYING；系统媒体卡采用语义按钮布局。
- 模拟器没有 LSPosed/词幕运行环境，不能据此确认 OS 4 上的实际歌词、图标显示或长时间后台可靠性。
- 测试包：`Q-music-android-v0.4.6-media-lyrics-fix-arm64-preview.apk`，可覆盖安装上一轮预览版。SHA-256：`B49A28D385D53BBCE4040C5CE0EF29484B7B05F053D5D866AD9DD937A11FE2D4`。
