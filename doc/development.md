# 桌面端开发与数据目录

[返回项目首页](../README.md)

## 数据存储

Windows 默认数据目录：

```text
%APPDATA%/q-music
```

若程序目录中存在 `portable` 文件夹，则使用 `portable/userData` 保存数据。

Windows 发布流程同时生成安装包与 `win_x64-green.7z` 免安装包。免安装包完整解压后运行 `Q-music.exe`，内附 `portable` 文件夹，数据保存在解压目录。升级时先退出程序，将新版解压到新目录，再复制旧版 `portable` 文件夹；不要覆盖旧数据。本地歌曲仍引用原文件路径。安装版用户继续使用 `x64-Setup.exe`。

Linux 默认数据目录：

```text
$XDG_CONFIG_HOME/q-music
```

未设置 `XDG_CONFIG_HOME` 时通常为 `~/.config/q-music`。

## 多端云同步

项目提供了 [Docker 部署配置](../deploy/sync-server/README.md)。部署同步服务并配置可信 HTTPS 后，
在客户端“设置 → 数据同步”中选择客户端模式，填写服务地址并输入连接码即可。首次认证后，
客户端会缓存设备密钥并自动重连。

## 本地开发

环境要求：

- Node.js >= 22
- npm >= 8.5.2

安装依赖并启动开发版：

```bash
npm ci
npm run dev
```

质量检查与生产构建：

```bash
npm run lint
npm run build
```

`npm run build` 只生成生产环境代码；构建 Windows x64 安装包请运行：

```bash
npm run pack
```

安装包默认输出到：

```text
build/Q-music-v<version>-x64-Setup.exe
```

## Arch Linux

生成 x86_64 pacman 包：

```bash
npm ci
npm run pack:arch
```

安装本地构建产物：

```bash
sudo pacman -U "./build/Q-music_<版本>_x64.pacman"
```

pacman 安装由系统包管理器负责升级；应用内会提示新版本，但不会自行覆盖系统
软件包。Electron 在原生 Wayland 下默认使用 ANGLE/EGL（`--use-gl=angle
--use-angle=gl`）启用 GPU 合成，并尝试通过桌面环境提供的 portal 注册全局快捷
键；X11/XWayland 仍使用桌面 OpenGL。应用会尊重显式传入的图形后端参数，若需
排查驱动兼容性可临时改回桌面 OpenGL：

```bash
q-music --use-gl=desktop
```

原生 Wayland 会自动使用轻量合成路径：关闭大面积实时毛玻璃采样，并降低全屏
音频可视化的绘制分辨率与刷新率，同时保留当前主题配色与面板层次。需要进一步
降低开销时，仍可在“设置 → 基本设置”开启“流畅模式”。

若桌面歌词的位置、置顶或透明效果受合成器限制，可临时回退到 XWayland：

```bash
q-music --ozone-platform=x11
```

Arch 真机建议至少回归：启动与单实例、在线/本地播放、媒体键、托盘、全局快捷
键、桌面歌词、`qmusic://` 深链，以及与 Android 端的局域网同步。
