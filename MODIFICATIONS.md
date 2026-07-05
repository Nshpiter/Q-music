# 二次修改说明

本仓库基于 [LX Music 桌面版](https://github.com/lyswhut/lx-music-desktop) 修改而来。以下为当前版本相对上游代码的主要改动范围，完整差异以 Git 历史和源码 diff 为准。

## 品牌与资源

- 将应用名称、安装包名称、窗口标题等调整为 Q-music。
- 替换或调整应用图标、托盘图标、页面图标及部分静态资源。
- 调整多语言文案中的品牌相关内容。

## 界面与交互

- 重构播放详情页视觉表现，包括唱片式封面、背景氛围、歌词布局和评论区域布局。
- 调整播放器底栏、侧边栏、工具栏、基础控件、弹窗、搜索框、进度条、音量按钮、播放模式按钮等界面样式。
- 增加或调整音频可视化效果。

## 播放详情页性能

- 将播放详情页唱片旋转从 Vue 响应式逐帧更新改为直接更新 DOM CSS 变量，降低播放时的高频重渲染开销。

## 构建与打包

- 将 Windows x64 安装包输出名称调整为 Q-music。
- 将应用 appId 和深链协议调整为 Q-music 独立值，避免与官方 LX Music 冲突。
- 将 GitHub publish 目标改为通过环境变量显式配置，避免误发到上游仓库。
- 将上游自动发布 GitHub Actions 调整为手动触发，禁用上游版本信息 dispatch。
- 移除官方 LX Music 版本信息兜底源，避免 Q-music 被引导更新到官方版。
- 关闭生产环境 renderer、renderer-lyric、renderer-scripts 的 source map 输出，减少发布包体积并降低源码暴露面。
- 保留上游 Electron Builder 打包流程和 native 依赖处理逻辑。

## 授权与归属

- 保留 Apache License 2.0 授权文本。
- 新增 `NOTICE` 记录上游项目和原作者信息。
- README 明确声明本项目为 LX Music 桌面版的独立二次修改版本，不是官方发行版。
- 项目元数据、应用内关于页和更新源已指向 <https://github.com/Nshpiter/Q-music>。
