# Q-music 桌面版

Q-music 是基于 [LX Music 桌面版](https://github.com/lyswhut/lx-music-desktop) 二次修改的 Electron & Vue 音乐软件。

本仓库不是 LX Music 官方仓库，也不代表原作者对本项目提供支持或背书。原项目由 lyswhut 维护，原始仓库地址为 <https://github.com/lyswhut/lx-music-desktop>。

当前仓库地址：<https://github.com/Nshpiter/Q-music>

## 二次修改说明

本项目在 LX Music 桌面版基础上进行了界面、品牌、图标、播放详情页、音频可视化和打包配置等定制。具体变更请查看 [MODIFICATIONS.md](./MODIFICATIONS.md)，完整差异以 Git 历史和源码 diff 为准。

## 技术栈

- Electron
- Vue 3
- TypeScript / JavaScript
- Less
- Webpack

## 开发与构建

要求：

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

Windows x64 安装包默认输出到 `build/Q-music-v0.1.0-x64-Setup.exe`。

本项目使用 `qmusic://` 作为深链协议，避免与官方 LX Music 的协议注册冲突。

## 许可证与上游协议

本项目基于 LX Music 桌面版二次修改，原项目基于 Apache License 2.0 发布，并包含额外的项目协议说明。Q-music 继续保留原项目许可证、上游归属声明和免责声明；本仓库的变更记录见 [MODIFICATIONS.md](./MODIFICATIONS.md)。

- 原项目：LX Music 桌面版
- 原仓库：<https://github.com/lyswhut/lx-music-desktop>
- 原作者：lyswhut
- 原许可证：Apache License 2.0

## 免责声明

本项目仅用于技术学习与交流。使用者应自行确认所在地法律法规、音乐平台条款以及版权要求，并自行承担使用本项目产生的风险。
