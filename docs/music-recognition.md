# 安卓听歌识曲（实验性）

搜索框右侧麦克风打开识曲面板。轻点开始后才请求麦克风权限，前台自动听取 10 秒，无需按住按钮。界面不再展示文件识别入口。录音只在内存中处理，不保存到本机。开始识别会暂停 Q-music 自己的播放，结束不自动恢复。

使用 VOICE_RECOGNITION 音源以 44.1 kHz 采集，通过低通滤波降到 8 kHz 单声道 PCM。优先把短音频发送至酷狗听音接口，匿名调用，不发送账号凭证，也不使用参考项目内硬编码的账号、Cookie 或设备标识。界面在开始前明确说明音频会发送给酷狗。

酷狗无匹配或暂不可用时，取同一段录音前 6 秒，由本地 WebAssembly 生成指纹发给网易云补充匹配，不再要求用户重新录音。网页指纹组件禁止网络连接。关闭、取消或退到后台会停止采集/请求，过期结果不会覆盖下一轮识别。

结果展示歌曲、歌手和专辑，点击后搜索对应平台，播放仍使用用户已有音源。本功能不提供新的播放授权，也不做哼唱识曲或其他应用内部声音采集。识别不到、静音、权限拒绝、网络异常和服务异常分别提示；这些非开放平台接口未来可能调整。

## 参考与来源

- 酷狗听音协议参考 [WalnutBai/lx-lxwalnut-music-mobile](https://github.com/WalnutBai/lx-lxwalnut-music-mobile/blob/c06ebcff357c1c84b0a88d66ff1d61f5c6fc775f/android/app/src/main/java/com/lxwalnut/music/mobile/recognition/MusicRecognitionModule.java)（Apache-2.0），固定提交 `c06ebcff357c1c84b0a88d66ff1d61f5c6fc775f`，位于 `main-debug` 分支。本项目独立实现匿名请求、边界检查和取消，不复制其悬浮窗、录音落盘或账号凭证。

- 接口流程和指纹资源参考 [NeteaseCloudMusicApiEnhanced/api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/tree/984cc021b8598cf94c22134f32a8426887fb2de7/public/audio_match_demo)，固定提交 `984cc021b8598cf94c22134f32a8426887fb2de7`。
- `android/app/src/main/assets/recognition/afp.js`、`afp.wasm.js` 原样保留该项目文件；同目录 `LICENSE` 保留上游 MIT 许可。上游示例将指纹实现归功于 [mos9527/ncm-afp](https://github.com/mos9527/ncm-afp)。这些资源来自其对网易云浏览器扩展的研究，不代表网易云官方提供第三方接入支持。
- 本项目独立实现安卓录音、系统文件选择、解码、PCM 桥接、状态管理和界面，不使用示例中的公共 CORS 代理。

## 验证边界

公开可播放曲目《My Soul — July》（网易云 ID 5308028）取 15 秒处的 6 秒片段，指纹请求返回同曲且匹配位置约 14.86 秒。该验证证明文件指纹与服务链路可用，不能替代不同手机、环境噪声和麦克风条件下的测试。
