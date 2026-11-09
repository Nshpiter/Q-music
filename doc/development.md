# Android 开发与构建

[返回 Android 首页](../README.md)

## Arch Linux 开发环境

需要：

- Node.js >= 18
- JDK 17
- Android SDK Platform 36
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

当前上游基线的 `targetSdkVersion` 为 33，采用 GitHub APK 侧载分发；准备
上架应用商店前需要升级 target API，并完整回归存储、通知和前台服务行为。
