# 二次修改说明

本工程基于 [LX Music Mobile](https://github.com/lyswhut/lx-music-mobile)
`1.8.4` 修改。

## 0.3.0 功能对齐（2026-09）

与 Q-music 桌面端对齐的风格与功能改造：

- 播放详情页重构为唱片机视觉：封面旋转（18 秒/圈、播放/暂停相位连续）、黑胶纹与唱针动画、封面虚化氛围背景与高光遮罩。
- 新增毛玻璃强度三档设置（清晰/平衡/沉浸），动态背景模糊半径与叠色随档位变化；兼容既有流畅模式。
- 播放详情页新增音质徽章快捷切换（STD/HQ/SQ/Hi-Res），换音质保留播放进度，音源无目标音质时自动沿 flac24bit→flac→320k→128k 降级并回显实际音质。
- 排行榜请求增加结构校验、递增退避重试与在途请求去重，失败时展示错误占位。
- 歌曲列表与来源选择使用各平台官方图标（打包本地 PNG，失败回退字母徽章）。
- 新增播放队列弹层：查看当前播放列表、点击跳播、自动定位当前歌曲。
- 新增歌曲下载：下载管理页（进度/速度/重试/删除）、列表菜单下载动作、文件写入公共 Music/QMusic 目录并触发媒体扫描（新增原生 `scanMediaFile`）。
- 新增官方账号线路：应用内 WebView 登录 QQ 音乐/网易云音乐（QQ 支持跳转 App 一键授权），官方线路优先解析播放地址并带 5 分钟 URL 缓存，未登录或失败自动回退音源 SDK（新增原生 `getWebCookie`/`clearWebCookie`）。
- 新增依赖 `react-native-webview`；`minSdkVersion` 由 21 提升至 24。
- 修复 `run-gradle.js` 在 Windows 11（NoDefaultCurrentDirectoryInExePath）下无法调用 gradlew.bat 的问题。

## 品牌与标识

- 应用名称调整为 Q-music。
- Android 应用 ID 调整为 `io.github.nshpiter.qmusic.mobile`，保留上游 Java namespace
  以减少无意义的原生代码迁移。
- Scheme URL 从 `lxmusic://` 调整为 `qmusic://`。
- 更新图标、启动图、关于页、项目地址与更新源。
- 增加可重复生成 Android 各密度图标与横竖屏启动图的脚本。

## 构建与发布

- 增加 Windows/Linux 通用的 Gradle 启动脚本。
- release 构建要求完整的正式签名配置，缺失时直接失败。
- 将 Android 工具链对齐为 AGP 8.6、Gradle 8.8 与 compileSdk 35。
- 增加内置 JS bundle、使用 debug keystore 的 standalone 测试变体与手动构建工作流。
- 将上游自动发布流程改为手动构建，移除上游版本仓库 dispatch。
- 移除上游版本源兜底，避免 Q-music 被更新成 LX Music Mobile。

## 保留能力

- 保留上游的后台播放、MediaSession、本地音乐、自定义源和同步实现。
- 保持同步数据结构兼容，便于与 Q-music 桌面端互通。
- 保留上游许可、项目协议、免责声明和作者归属。
