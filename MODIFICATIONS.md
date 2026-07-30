# 二次修改说明

本工程基于 [LX Music Mobile](https://github.com/lyswhut/lx-music-mobile)
`1.8.4` 修改。

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
