# 哔哩哔哩公开音频

在搜索源中选择哔哩哔哩，可搜索公开视频；输入 BV 号或完整视频链接可列出各分 P。播放时重新解析公开视频的 AAC 音频，不跨平台替换同名歌曲。未提供会员、付费内容或登录接口；不自动猜配音乐平台的歌词。

接口流程参考 [WalnutBai/lx-lxwalnut-music-mobile](https://github.com/WalnutBai/lx-lxwalnut-music-mobile/tree/main-debug)（Apache-2.0），本项目独立实现网络封装、取消与错误处理、分页及多 P 标识。

## 合集与导入

搜索源选择哔哩哔哩后，可以粘贴空间合集或系列链接分页查看。支持 `space.bilibili.com/<用户号>/lists/<合集号>`（`type=season` 或 `type=series`）以及旧版 `channel/collectiondetail?sid=`、`channel/seriesdetail?sid=`。

「我的 → 导入歌单 → 链接导入 → 哔哩哔哩」可把上述合集、系列或 BV 视频的多 P 导入本地歌单。导入保持返回顺序，分页失败、重复页面或合集总数变化时终止保存，避免误存不完整歌单。跨视频合集中的每个条目代表一个视频；需要其全部分 P 时，再使用该视频 BV 号导入。暂不支持登录收藏夹、短链接自动展开或付费合集。

合集接口与分页方式参考 [yt-dlp 的 BilibiliCollectionListIE / BilibiliSeriesListIE](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/bilibili.py)，独立编写链接解析和完整性验证。未复制其实现代码。

## 标识来源

哔哩哔哩标识采用 [Simple Icons v16 的 Bilibili 品牌矢量](https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/bilibili.svg)（CC0-1.0）；品牌及商标归哔哩哔哩所有，用于标明内容来源，不代表官方合作。PC 保留 SVG，安卓由同一 SVG 输出 192px PNG，本地打包，不依赖运行时联网获取图标。

## 搜索结果选集与联想

PC 和安卓的 B 站结果旁提供「选集」，按需读取视频详情。多 P 显示独立 CID 对应的歌曲；属于空间合集的视频可切换「所属合集」。多 P 每页展示 30 集、播放时保留完整分 P 队列；跨视频合集分页读取，播放当前页，界面明确说明范围。关闭或切换后丢弃旧请求，读取失败可重试。单条长视频不会根据标题伪造分曲。

搜索联想调用 B 站公开 `s.search.bilibili.com/main/suggest` 接口，读取纯文本候选并去重；指定 B 站时不再回退其他平台。安卓联想跟随当前搜索源，切换平台立即清除旧结果。标题支持数值与十六进制 HTML 实体。

参考 WalnutBai 项目的 `src/utils/musicSdk/bilibili/musicSearch.js` 多 P 身份处理，采用按需选集以避免搜索每一行都附加详情请求。
