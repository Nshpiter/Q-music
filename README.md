<p align="center">
  <img src="./doc/images/icon.png" width="104" alt="Q-music 图标">
</p>

<h1 align="center">Q-music</h1>

<p align="center">找喜欢的歌，整理自己的歌单，享受每一次播放。</p>
<p align="center">基于 LX Music 二次开发，支持 Windows、macOS、Arch Linux 与 Android。</p>

<p align="center">
  <a href="https://github.com/Nshpiter/Q-music/releases/latest"><img alt="最新正式版" src="https://img.shields.io/github/v/release/Nshpiter/Q-music?label=Release&amp;color=2ea66f"></a>
  <a href="./LICENSE"><img alt="Apache-2.0 许可证" src="https://img.shields.io/badge/License-Apache--2.0-blue"></a>
  <a href="https://github.com/Nshpiter/Q-music/tree/android"><img alt="Android 源码" src="https://img.shields.io/badge/Android-源码-3ddc84"></a>
  <a href="https://linux.do/"><img alt="LINUX DO 社区" src="https://img.shields.io/badge/LINUX%20DO-社区-f0b84c"></a>
</p>

<p align="center">
  <a href="https://github.com/Nshpiter/Q-music/releases/latest"><strong>下载最新版</strong></a> ·
  <a href="#界面预览">界面预览</a> ·
  <a href="#开始使用">开始使用</a> ·
  <a href="./publish/changeLog.md">更新日志</a> ·
  <a href="https://github.com/Nshpiter/Q-music/issues">反馈问题</a>
</p>

> 在线音乐播放与下载通常需要自行导入可用音源。登录音乐平台用于读取推荐、歌单及操作收藏，不能代替音源配置。

## 界面预览

**桌面首页 · 每日精选与更多歌单**

![Q-music 桌面首页：平台推荐、每日精选和歌单发现](./doc/images/desktop-home.webp)

<table>
  <tr>
    <td width="50%" align="center"><strong>经典极简 · 封面与双语歌词</strong></td>
    <td width="50%" align="center"><strong>沉浸歌词 · 封面取色与动态氛围</strong></td>
  </tr>
  <tr>
    <td><img src="./doc/images/desktop-classic.webp" alt="经典播放详情，封面、双语歌词及底部播放控制"></td>
    <td><img src="./doc/images/desktop-immersive.webp" alt="沉浸播放详情，专辑取色背景与歌词"></td>
  </tr>
</table>

**Android · 经典与沉浸，两种听歌方式**

<p align="center">
  <img src="./doc/images/mobile-classic.webp" width="300" alt="Android 经典播放页，封面、进度及收藏菜单">
  <img src="./doc/images/mobile-player.webp" width="300" alt="Android 沉浸播放页，封面、播放控制和收藏入口">
</p>

<details>
<summary>展开查看平板设置与导航</summary>

![Android 平板设置：双栏分类与导航位置选择](./doc/images/tablet-settings.webp)

平板与车机可选择左侧、右侧或底部导航。以上为应用实际运行截图；Android 截图来自模拟器，界面随主题、字号和设备尺寸调整。

</details>

## 可以做什么

### 找歌与发现

- **聚合搜索**：合并多个来源，支持综合 / 音质排序；也能单独选择平台。搜索历史、热门搜索和联想在搜索框展开后查看。
- **平台账号**：支持登录 QQ 音乐、网易云音乐与酷狗音乐，在不同平台的个人歌单和推荐之间切换；可用功能取决于平台授权及接口。
- **每日推荐**：以完整歌单呈现，另外提供精选歌单、分类发现与热门歌手。平台账号推荐与本地精选分别标明。
- **B 站音频**：支持公开视频搜索、BV 号 / 链接、多 P 与合集 / 系列；可导入公开收藏夹并更新。多 P 播放按队列继续下一 P。
- **听歌识曲（Android）**：点击搜索栏麦克风开始聆听，录音结束后自动识别；开始前会说明录音与短音频上传的用途。

### 听歌与管理

- **两套播放详情**：经典极简与沉浸歌词；支持双语、逐字歌词及封面取色动态背景，具体歌词内容取决于平台和歌词源。
- **随手收藏**：点爱心加入或移出默认本地歌单；PC 点右下角三角，手机长按爱心或打开更多菜单，可选择其他本地歌单或已登录平台的可写歌单。B 站内容支持本地收藏。
- **独立播放队列**：移除队列歌曲不会删除原歌单；“播放全部”可选择替换队列或追加到队尾。安卓支持队列拖动排序。
- **播放历史**：持久保存最近播放，可删除、清空或重新播放，并能设置历史上限。PC 在左侧导航，手机在「我的」。
- **本地音乐与下载**：导入歌曲 / 文件夹、管理下载任务与保存位置；文件移除与任务记录清理分别处理。
- **网易云播放记录（PC）**：网易云原曲经备用源等线路播放时，仍按原始歌曲信息回传实际收听记录；需要有效账号。

### 外观与设备

- **主题随心调整**：支持浅色、深色、跟随系统和自定义时段切换，切换明暗时保留主题配色；还可调整背景图、透明度和播放风格。
- **兼顾观感与流畅**：液态玻璃可单独开关，流畅模式可减少模糊与动效。安卓实时玻璃默认关闭，可按设备性能开启。
- **Android 专属适配**：手机、平板、车机布局，设置搜索、下载位置入口、后台播放与系统媒体控制。
- **桌面歌词**：PC 提供桌面歌词与全局快捷键；Android 可开启独立悬浮歌词，也保留词幕支持，两个通道互相独立。

## 开始使用

1. **[下载并安装](https://github.com/Nshpiter/Q-music/releases/latest)**：各平台选包、安装和更新方法见对应 Release 的发布说明。进入设置中的音源管理，导入自己的音源，选择主音源及备用顺序；也可以先导入本地音乐。
2. **按需登录账号**：在音乐账号中选择 QQ 音乐、网易云或酷狗，读取自己的歌单和推荐；无需登录也能使用已有音源搜索和本地歌单。
3. **搜索并播放**，在爱心菜单中选择收藏目标；下载可从歌曲菜单或下载入口操作。手机的下载目录在设置首页和下载设置中。
4. **换设备时选择合适的同步方式**，见下表。需要迁移已有数据时，先备份再恢复。

## 歌单同步、云端曲库与配置备份

三个功能用途不同，可以按需要使用：

| 你想做的事 | 使用方式 | 范围 |
| --- | --- | --- |
| 在多台设备间同步 Q-music 歌单 | 自建 [同步服务](./deploy/sync-server/README.md)，在设置中连接 | 自动同步歌单与“不喜欢”列表 |
| 把云盘当作自己的音乐库 | 连接 S3 兼容存储（含 Cloudflare R2）或 WebDAV | 手动上传歌曲，导入云端歌曲 / 歌单 |
| 把设置和音源迁移到另一台设备 | 同一连接内选择「设置与音源」 | 手动加密备份 / 恢复通用设置、完整音源脚本和主备顺序；可选账号状态 |

配置备份需要保存好备份密钥；账号默认不上传，过期凭证仍需重新登录。配置备份不是后台自动双向同步，也不会迁移设备权限或下载目录。云服务连接填写、备份与恢复步骤见 [配置备份指南](./doc/cloud-config-backup.md)。

## 常见问题

<details>
<summary>为什么装好后不能直接播放或下载？</summary>

先在音源管理中导入可用音源并检查主备选择。平台登录主要提供歌单、推荐及收藏能力；可用音质、播放和下载取决于音源及对应内容。失败时请一并反馈平台、歌曲、错误提示与音源名称，不要公开密钥。

</details>

<details>
<summary>为什么歌单同步或收藏提示重新登录、需要验证？</summary>

平台凭证会过期，平台也可能要求安全验证。请按提示重新授权或完成验证，再刷新歌单；只有本人有写入权限的歌单才会出现在平台收藏目标中。

</details>

<details>
<summary>安卓歌词、后台播放和耗电怎么设置？</summary>

独立悬浮歌词需授予悬浮窗权限；通知和后台播放按系统提示授权。厂商系统仍可能限制后台运行。觉得模糊或动效吃性能时，先关闭液态玻璃或开启流畅模式，无需更换主题。

</details>

<details>
<summary>便携版怎么更新，数据在哪里？</summary>

完整解压便携包后运行 `Q-music.exe`，数据在 `portable/userData`。升级前退出程序，将新版解压到新目录，再复制旧版 `portable` 文件夹。安装版数据通常在 `%APPDATA%/q-music`；更多路径与 Linux 说明见 [桌面端开发与数据目录](./doc/development.md)。

</details>

## 开发与反馈

桌面源码在本仓库默认分支，Android 源码在 [`android` 分支](https://github.com/Nshpiter/Q-music/tree/android)。

- [桌面端开发、构建与 Linux 说明](./doc/development.md)
- [Android 使用与构建](https://github.com/Nshpiter/Q-music/blob/android/README.md)
- [macOS 安装与双架构构建](./doc/macos-build.md)
- [完整更新日志](./publish/changeLog.md)

问题请提交至 [Issues](https://github.com/Nshpiter/Q-music/issues)，附上系统与软件版本、复现步骤、错误提示，以及必要的截图或歌曲 / 歌单链接。请勿公开账号 Cookie、Token、音源密钥或私有配置。

## 致谢与许可

Q-music 基于 [LX Music Desktop](https://github.com/lyswhut/lx-music-desktop) 与 [LX Music Mobile](https://github.com/lyswhut/lx-music-mobile) 二次开发，是独立项目；不代表上游或音乐平台官方。

感谢 [WalnutBai/lx-lxwalnut-music-mobile](https://github.com/WalnutBai/lx-lxwalnut-music-mobile) 等开源项目提供的实现参考，也感谢 [LINUX DO 社区](https://linux.do/) 的交流与反馈。

项目使用 [Apache License 2.0](./LICENSE)，保留上游归属与协议；详见 [NOTICE](./NOTICE) 和 [二次修改说明](./MODIFICATIONS.md)。音乐、歌词、封面及平台商标归各自权利人所有，使用时请遵守适用的法律、平台条款与版权要求。

## Star 趋势

<a href="https://star-history.com/#Nshpiter/Q-music&amp;Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Nshpiter/Q-music&amp;type=Date&amp;theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Nshpiter/Q-music&amp;type=Date">
    <img alt="Q-music GitHub Star 数量变化趋势" src="https://api.star-history.com/svg?repos=Nshpiter/Q-music&amp;type=Date" width="100%">
  </picture>
</a>
