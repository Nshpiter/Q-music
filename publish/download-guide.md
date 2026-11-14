## 下载与安装

安装包在本页下方的 **Assets** 中。Windows 一般选安装版，安卓手机一般选 `arm64-v8a.apk`，其他设备可以对照下表：

| 设备 | 选择的文件 | 安装与更新 |
| --- | --- | --- |
| Windows 10 / 11 · x64 | `x64-Setup.exe`；免安装选 `win_x64-green.7z` | 安装版支持应用内更新；便携版需完整解压 |
| Android 7.0+ · 手机 / 平板 / 车机 | 多数设备选 `arm64-v8a.apk`；不确定架构选 `universal.apk` | 支持应用内检查与下载更新；另提供 armeabi-v7a / x86 / x86_64 |
| macOS 12+ · M 系列 | `arm64.dmg` | 拖入「应用程序」，更新时退出应用，再用新版替换 |
| macOS 12+ · Intel | `x64.dmg` | 安装与更新方法同上 |
| Arch Linux · x86_64 | `.pacman` | 使用 `sudo pacman -U "<安装包路径>"` 安装或升级 |

- **便携版升级**：退出程序，将新版完整解压到新目录，再复制旧版的 `portable` 文件夹以保留数据。
- **安卓升级**：正式包沿用应用 ID 与签名，可覆盖正式旧版；独立预览版与正式版分别保存数据。
- **macOS 首次打开**：安装包使用 ad-hoc 签名，未做 Apple 公证。遇到系统拦截时，请查看 [首次打开的方法](https://github.com/Nshpiter/Q-music/blob/master/doc/macos-build.md)。
- **下载较慢时**：Windows 和安卓可以在应用内更新，下载失败会尝试备用线路。需要检查文件完整性时，可以使用对应的 `SHA256SUMS` 文件。
