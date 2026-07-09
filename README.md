<p align="center">
  <img src="./doc/images/icon.png" width="150" alt="Q-music logo">
</p>

<h1 align="center">Q-music 桌面版</h1>

<p align="center">
  <a href="https://github.com/Nshpiter/Q-music/releases"><img alt="Release" src="https://img.shields.io/github/v/release/Nshpiter/Q-music?include_prereleases&label=release"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
  <img alt="Electron" src="https://img.shields.io/badge/electron-40.9.2-47848f">
  <img alt="Vue" src="https://img.shields.io/badge/vue-3-42b883">
</p>

<p align="center">一个基于 Electron 与 Vue 开发的桌面音乐软件。</p>

## 说明

Q-music 是基于 [LX Music 桌面版](https://github.com/lyswhut/lx-music-desktop) 的二次修改版本，主要调整了应用品牌、界面风格、图标、播放详情页、音频可视化和打包更新配置。

本仓库不是 LX Music 官方仓库，也不代表原作者对本项目提供支持或背书。上游项目由 lyswhut 维护，原始仓库地址为 <https://github.com/lyswhut/lx-music-desktop>。

所用技术栈：

- Electron 40
- Vue 3
- TypeScript / JavaScript
- Less
- Webpack

主要支持平台：

- Windows 10 / 11

软件下载请查看 [GitHub Releases](https://github.com/Nshpiter/Q-music/releases)。

软件变化请查看 [更新日志](./publish/changeLog.md) 与 [二次修改说明](./MODIFICATIONS.md)。

若遇到 Q-music 相关问题，可在 [Q-music Issues](https://github.com/Nshpiter/Q-music/issues) 反馈；上游 LX Music 的使用说明与常见问题可参考 [LX Music 文档](https://lyswhut.github.io/lx-music-doc/desktop/faq)。

## Scheme URL 支持

Q-music 使用独立的 `qmusic://` Scheme URL，用于避免与上游 LX Music 的协议注册冲突。

## 数据存储目录

默认情况下，软件的数据存储在：

- Windows：`%APPDATA%/q-music`

在 Windows 平台上，若程序目录中存在 `portable` 文件夹，则会自动使用 `portable/userData` 作为数据存储目录。

## 用户界面

![Q-music desktop UI](./doc/images/app.png)

## 开发与构建

环境要求：

- Node.js >= 22
- npm >= 8.5.2

常用命令：

```bash
npm install
npm run dev
npm run lint
npm run build
npm run pack
```

Windows x64 安装包默认输出到：

```text
build/Q-music-v0.1.7-x64-Setup.exe
```

## 贡献代码

本项目目前以个人二次修改与学习维护为主。提交 PR 或 Issue 时，请尽量说明变更目的、影响范围和复现方式，避免提交构建产物、私有配置、token 或无关格式化改动。

## 项目协议

本项目基于 [Apache License 2.0](./LICENSE) 许可证发行，并保留 LX Music 桌面版的上游归属声明、附加协议与免责声明。

请特别注意：

- 本项目是 LX Music 桌面版的独立二次修改版本，并非官方版本。
- 本项目不拥有任何音乐平台数据、音频、歌词、封面等版权数据。
- 使用者应自行确认所在地法律法规、音乐平台条款以及版权要求，并自行承担使用本项目产生的风险。
- 上游项目信息与本项目二次修改记录请查看 [NOTICE](./NOTICE) 与 [MODIFICATIONS.md](./MODIFICATIONS.md)。
