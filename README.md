<p align="center"><img src="./doc/images/icon.png" width="104" alt="Q-music 图标"></p>
<h1 align="center">Q-music Android</h1>
<p align="center">在手机、平板和车机上，继续听自己喜欢的音乐。</p>
<p align="center">
  <a href="https://github.com/Nshpiter/Q-music/releases/latest"><strong>下载 APK</strong></a> ·
  <a href="https://github.com/Nshpiter/Q-music#readme">项目首页</a> ·
  <a href="./doc/development.md">开发与构建</a> ·
  <a href="https://github.com/Nshpiter/Q-music/issues">问题反馈</a>
</p>

Q-music 的安卓客户端，支持 Android 7.0 及以上。可以搜索歌曲、管理本地音乐，也可以登录 QQ 音乐、网易云音乐或酷狗，听自己的收藏和每日推荐。

第一次使用请先导入自己的音源，或添加本地歌曲。平台登录用于歌单、推荐和收藏，播放与下载仍需要可用音源。安装包选择见 [Release 发布说明](https://github.com/Nshpiter/Q-music/releases/latest)。

## 界面预览

<p align="center">经典与沉浸，两种听歌方式。</p>

<p align="center">
  <img src="./doc/images/mobile-classic.webp" width="300" alt="Android 经典播放页与收藏入口">
  <img src="./doc/images/mobile-player.webp" width="300" alt="Android 沉浸播放详情">
</p>

<details>
<summary>展开查看平板设置与导航</summary>

![Android 平板双栏设置与导航位置选择](./doc/images/tablet-settings.webp)

</details>

主题、字号和导航位置都可以在设置里调整。

## 移动端功能

- **搜索与发现**：聚合 / 单平台搜索、综合 / 音质排序、搜索框内历史与热搜、每日推荐、分类歌单及热门歌手。
- **平台账号**：登录 QQ 音乐、网易云或酷狗，查看自己的推荐和歌单，也能收藏到有编辑权限的歌单。酷狗另支持 Cookie / JSON 登录。
- **B 站音频**：搜索公开视频、BV 号、多 P、合集 / 系列与公开收藏夹导入及更新；播放列表内切换分 P，按队列播放下一 P。
- **两套播放风格**：保留经典界面，另有沉浸歌词、封面取色背景；双语 / 逐字歌词取决于歌词源，纯音乐与普通缺失歌词分别显示。
- **收藏与队列**：点击爱心切换默认本地收藏，长按或更多菜单选择其他歌单；独立队列可排序、移除、清空，播放全部可选择追加或替换。
- **播放历史**：在「我的」找回刚听过的歌，支持单条删除、清空和调整保存数量。
- **网易云播放记录**：登录后按实际收听时长回传网易云歌曲的播放记录，使用第三方音源时也保留原曲信息。
- **智能换源**：播放失败时尝试备用线路；可以调整平台顺序，选择是否自动降低音质或跨平台找歌。
- **听歌识曲**：点击搜索栏麦克风开始聆听，录音结束后自动识别；开始前会说明录音与短音频上传的用途。
- **本地与下载**：本地音乐导入、下载任务管理，设置首页可直接进入下载位置设置。
- **歌词与后台**：通知栏、锁屏与蓝牙媒体控制；独立桌面悬浮歌词、翻译设置及词幕支持，独立悬浮歌词需要悬浮窗权限。
- **手机 / 平板 / 车机**：手机使用底部导航，大屏可选择左侧、右侧或底部，也可以打开悬浮导航。设置支持搜索，字号调大后列表会跟着调整。
- **主题与性能**：浅色 / 深色 / 跟随系统 / 自定义时段，保留主题配色；实时玻璃默认关闭，可按设备性能启用或使用流畅模式。

## 开始使用

1. 从 [Releases](https://github.com/Nshpiter/Q-music/releases/latest) 安装对应 APK。
2. 在「我的 → 设置 → 音源管理」导入自己的音源，并选择主音源及备用顺序；也可先导入本地音乐。
3. 需要账号推荐和歌单时，进入音乐账号登录相应平台。
4. 搜索并播放；爱心用于默认本地收藏，长按及更多菜单可选其他目标。B 站内容只提供本地收藏。

应用内支持检查更新和备用下载线路，具体安装与升级说明随各版 Release 提供。

## 同步与云端备份

| 功能 | 用途 |
| --- | --- |
| [自建同步服务](https://github.com/Nshpiter/Q-music/tree/master/deploy/sync-server) | 自动同步 Q-music 歌单和“不喜欢”列表 |
| S3 兼容存储 / Cloudflare R2 / WebDAV 曲库 | 手动上传歌曲，导入云端歌曲或歌单 |
| 「设置与音源」配置备份 | 手动加密备份 / 恢复设置、完整音源和主备顺序，可选 QQ / 网易云 / 酷狗账号状态 |

设置和音源需要手动备份、手动恢复，记得保管好备份密钥。账号状态默认不上传，可以自行勾选；换设备后还需要重新设置下载目录和系统权限。步骤见 [配置备份与恢复](./doc/cloud-config-backup.md)。

## 文档与开发

- [Android 开发、签名与打包](./doc/development.md)
- [后台播放与权限说明](./doc/android-background-playback.md)
- [B 站接口与内容范围](./doc/bilibili.md)
- [酷狗封面与安全验证](./doc/kugou-artwork-verification.md)
- [iOS 适配状态](./doc/ios-support.md)：目前没有可用的 iOS 安装包

独立应用 ID 为 `io.github.nshpiter.qmusic.mobile`，可与上游 LX Music Mobile 共存，使用 `qmusic://` 深链。应用基于 React Native，与 Electron 桌面端分开构建，通过兼容的数据格式与同步协议协作。

## 反馈与许可

请到 [Issues](https://github.com/Nshpiter/Q-music/issues) 提供系统 / 软件版本、复现步骤和错误提示；不要公开 Cookie、Token、音源密钥或私有配置。

基于 [LX Music Mobile](https://github.com/lyswhut/lx-music-mobile) 二次开发，感谢 [WalnutBai/lx-lxwalnut-music-mobile](https://github.com/WalnutBai/lx-lxwalnut-music-mobile) 等开源项目提供参考。项目与平台官方无关，遵循 [Apache License 2.0](./LICENSE)；上游归属及修改说明见 [NOTICE](./NOTICE) 与 [MODIFICATIONS.md](./MODIFICATIONS.md)。音乐、歌词和封面归各自权利人所有。

感谢 [LINUX DO 社区](https://linux.do/) 的交流与反馈。
