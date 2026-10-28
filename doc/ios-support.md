# iOS 适配状态

核对日期：2026-10-28。当前 Android 工程不能直接生成可用的 iOS 安装包；仓库中的 `ios/` 是保留的 React Native 工程骨架，不代表已有 iPhone 版本。

## 已有基础

- `ios/Podfile`、Xcode 工程、React Native Navigation 启动入口。
- React/TypeScript 页面、歌单和云端曲库逻辑可复用，但须核对各自依赖的原生能力。
- 播放库包含 iOS 实现，仍需在当前锁定版本上验证编译、后台播放、锁屏控制和中断恢复。

## 当前阻塞

| 能力 | 当前代码 | iOS 需要完成的工作 |
| --- | --- | --- |
| 应用启动和系统工具 | `src/utils/nativeModules/utils.ts` 直接引用 `UtilsModule`，仅 Android 有实现 | 提供 iOS 原生桥或系统替代实现，拆开通知、文件选择、屏幕常亮与平台专属设置 |
| 自定义音源 | `UserApiModule` 和 Android QuickJS 运行时 | 实现独立脚本运行环境、网络桥、取消与多音源隔离；不能以空实现伪装可用 |
| 平台接口加密 | `CryptoModule` 的 RSA/AES 同步和异步调用 | 兼容现有协议的 iOS 加解密实现与已知向量验证 |
| 文件与云端导入 | Android 路径、权限和文件选择代码 | 使用应用沙盒、系统文件选择器及安全作用域 URL；验证下载、导入和重启后访问 |
| 平台登录 | WebView Cookie、QQ 回调和 Android Intent | iOS Cookie 存储、URL scheme/回调处理及真实账号授权验证 |
| 后台与系统交互 | 安卓通知、词幕、悬浮歌词、退出及返回手势 | 后台音频与系统媒体控制；移除 Android 专属入口，使用 iOS 页面返回行为 |
| 安装和更新 | APK 安装、Android ABI 与更新清单 | 独立 iOS 分发流程，不复用 APK 更新安装逻辑 |

`ios/LxMusicMobile/Info.plist` 仍使用 `LxMusicMobile` 名称，图标目录没有成套图标，也尚未配置后台音频。需要在核心原生能力就绪后一起完成产品化配置。

## 建议落地顺序

1. 在 macOS/Xcode 上完成依赖兼容和模拟器启动；先打通本地文件播放、队列、歌词和锁屏控制。
2. 实现音源运行环境与加密桥，验证搜索、在线播放、主备用源、下载；再接平台登录及 S3/WebDAV。
3. 验证 iPhone/iPad 布局、权限、音频中断和后台恢复，最后配置设备签名和安装渠道。

模拟器编译不需要付费开发者账户；真机个人调试可使用 Xcode 的个人签名。TestFlight、App Store 或面向他人持续分发需要相应开发者账户、签名配置及渠道审核。当前尚未生成或验证 iOS IPA，也未承诺现有 Android 功能可全部原样移植。
