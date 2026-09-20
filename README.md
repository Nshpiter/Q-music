<p align="center">
  <img src="./doc/images/icon.png" width="150" alt="Q-music logo">
</p>

<h1 align="center">Q-music Android</h1>

<p align="center">Q-music 的 Android 客户端，基于 React Native 与 LX Music Mobile 二次开发。</p>

## Q-music 移动端体验

- 面向手机竖屏优化的单列搜索首页，视觉语言与桌面端保持一致。
- 播放详情采用紧凑统一的播放控件和歌词排版，支持左右滑动切换封面与歌词。
- 热门搜索与历史记录可独立开关，使用紧凑的横向列表；热搜支持刷新及超时反馈，历史支持长按移除。
- 每日精选可独立选择 QQ 音乐或网易云账号推荐；QQ 优先官方每日 30 首，其次账号雷达；不可用时明确标记本地精选。
- 保留歌单导入、设置导入及与桌面端通用的列表备份格式。
- 平台账号入口仅保留 QQ 音乐与网易云，支持导入和更新自己的平台歌单；歌单页也可导入外部歌单。
- 可连接自建 Q-music 同步服务，让 Windows、Arch Linux 与 Android 自动同步歌单和不喜欢列表。
- 底部导航与播放条共用实时玻璃背景、曲面折射及弹性动效；流畅模式提供降级，并尊重系统减少动画设置。
- Windows、Arch Linux 与 Android 的版本统一通过 Q-music 项目维护和发布。

## 当前范围

- Android 7.0 及以上系统（官方线路的 WebView 登录要求 minSdk 24）。
- 后台播放、通知栏/锁屏媒体控制、蓝牙控制。
- 在线检索、自定义源、本地音乐与播放页歌词；手机播放详情不再提供桌面歌词按钮。
- 与 Q-music 桌面端兼容的局域网和同步服务协议。
- 独立应用 ID `io.github.nshpiter.qmusic.mobile`，可与 LX Music Mobile 共存。
- 独立 `qmusic://` Scheme URL。

本工程与 Electron 桌面端分开维护。桌面端继续使用 Vue/Electron，移动端使用
React Native；两端通过兼容的数据格式与同步协议协作。

多端同步服务可直接使用项目提供的 [Docker 部署配置](https://github.com/Nshpiter/Q-music/tree/master/deploy/sync-server)。服务部署完成后，在各客户端填写同一 HTTPS 地址和连接密码即可。

## Arch Linux 开发环境

需要：

- Node.js >= 18
- JDK 17
- Android SDK Platform 35
- Android Build Tools 35.0.0
- Android NDK 26.1.10909125
- 已启用 USB 调试的 Android 设备

安装依赖并确认设备：

```bash
npm ci
adb devices -l
```

启动 Metro：

```bash
npm start
```

另开终端运行调试版：

```bash
adb reverse tcp:8081 tcp:8081
npm run dev
```

构建依赖 Metro 的开发调试 APK：

```bash
npm run pack:android:debug
```

构建内置 JS bundle、可直接侧载的独立测试 APK：

```bash
npm run pack:android:standalone
```

两类产物分别位于 `android/app/build/outputs/apk/debug/` 和
`android/app/build/outputs/apk/standalone/`。日常真机验收应安装 standalone 包；
debug 包必须同时运行 Metro，并执行 `adb reverse tcp:8081 tcp:8081`。

桌面端图标更新后，可先把同一张 PNG 放到 `doc/images/icon.png`，再重新生成
Android 各密度图标与横竖屏启动图。该脚本依赖 Windows 的 `System.Drawing`，
只在 Windows PowerShell 7 中运行：

```powershell
pwsh ./scripts/generate-android-assets.ps1
```

## Release 构建与签名

`npm run pack:android` 会启用 ProGuard，并要求正式发布密钥；未配置签名时会
直接失败，避免误发 debug key 签名的 release APK。在
`android/keystore.properties` 配置独立密钥，或通过 `MYAPP_UPLOAD_*` Gradle
属性注入签名信息：

```bash
npm run pack:android
```

`android/keystore.properties` 示例：

```properties
storeFile=app/q-music-release.keystore
storePassword=...
keyAlias=...
keyPassword=...
```

release 产物位于 `android/app/build/outputs/apk/release/`。首发前必须安装并
回归 release APK，standalone 构建使用 debug keystore 且不启用 ProGuard，不能
覆盖正式发布风险。不要提交正式 keystore、密码或 `keystore.properties`；
测试包与正式包若签名不同，不能原位覆盖升级。

## 真机回归重点

- 息屏、切后台、从最近任务划走后的播放行为。
- 通知栏、锁屏、耳机和蓝牙的播放控制。
- Android 13 及以上通知权限和文件授权。
- 本地音乐目录授权后重启应用能否继续访问。
- 自定义源导入、搜索、播放和网络切换。
- 与 Arch Linux 桌面端新增、删除和冲突歌单同步；测试前先备份歌单。
- `adb shell am start -a android.intent.action.VIEW -d "qmusic://player/pause"` 深链。

独立应用 ID 不会继承 LX Music Mobile 的沙盒数据，已有歌单和设置需通过导入
或同步迁移。

当前上游基线的 `targetSdkVersion` 为 29，适合先做 GitHub APK 侧载测试；准备
上架应用商店前需要升级 target API，并完整回归存储、通知和前台服务行为。

## 上游与许可

Q-music Android 基于
[LX Music Mobile](https://github.com/lyswhut/lx-music-mobile) 修改。上游归属、
许可和二次修改范围见 [NOTICE](./NOTICE) 与 [MODIFICATIONS.md](./MODIFICATIONS.md)。

本项目依据 [Apache License 2.0](./LICENSE) 发布，并保留应用内展示的项目协议
和免责声明。Q-music 不拥有音乐、歌词、封面等第三方版权数据。
