export interface SettingTabMeta {
  id: string
  titleKey: string
  summaryKey: string
  icon: string
  group?: 'setting_group_personal' | 'setting_group_listening' | 'setting_group_library' | 'setting_group_app'
  quickAnchors?: ReadonlyArray<{ section: string, labelKey: string }>
}

export interface SettingSearchEntry {
  section: string
  tab: string
  titleKey: string
  keywords: string
}

export const SETTING_GROUPS = [
  'setting_group_personal',
  'setting_group_listening',
  'setting_group_library',
  'setting_group_app',
] as const

export const SETTING_TABS: readonly SettingTabMeta[] = [
  {
    id: 'SettingOverview',
    titleKey: 'setting__overview',
    summaryKey: 'setting_quick_jump',
    icon: 'plex',
  },
  {
    id: 'SettingBasic',
    titleKey: 'setting__basic',
    summaryKey: 'setting_summary_basic',
    icon: 'setting',
    group: 'setting_group_personal',
    quickAnchors: [
      { section: 'basic_theme', labelKey: 'theme_appearance' },
      { section: 'basic_glass', labelKey: 'setting__basic_glass' },
      { section: 'style-snippets', labelKey: 'style_snippets' },
      { section: 'basic_source', labelKey: 'setting__basic_source' },
    ],
  },
  {
    id: 'SettingHotKey',
    titleKey: 'setting__hot_key',
    summaryKey: 'setting_summary_hot_key',
    icon: 'tune-variant',
    group: 'setting_group_personal',
  },
  {
    id: 'SettingPlay',
    titleKey: 'setting__play',
    summaryKey: 'setting_summary_play',
    icon: 'play-outline',
    group: 'setting_group_listening',
    quickAnchors: [
      { section: 'crossfade_seconds', labelKey: 'crossfade_seconds' },
      { section: 'setting_player_footer_lyric', labelKey: 'setting__play_footer_lyric' },
      { section: 'basic_play_quality', labelKey: 'setting__play_playQuality' },
      { section: 'play_fallback', labelKey: 'playback_fallback_title' },
    ],
  },
  {
    id: 'SettingPlayDetail',
    titleKey: 'setting__play_detail',
    summaryKey: 'setting_summary_play_detail',
    icon: 'music',
    group: 'setting_group_listening',
    quickAnchors: [
      { section: 'lyric_arrangement', labelKey: 'lyric_arrangement' },
      { section: 'play_detail_video', labelKey: 'detail_video' },
      { section: 'model-lyrics', labelKey: 'model_lyrics' },
      { section: 'lyric_dictionary', labelKey: 'lyric_dictionary' },
    ],
  },
  {
    id: 'SettingDesktopLyric',
    titleKey: 'setting__desktop_lyric',
    summaryKey: 'setting_summary_desktop_lyric',
    icon: 'text',
    group: 'setting_group_listening',
  },
  {
    id: 'SettingOdc',
    titleKey: 'setting__odc',
    summaryKey: 'setting_summary_odc',
    icon: 'headphones',
    group: 'setting_group_listening',
  },
  {
    id: 'SettingList',
    titleKey: 'setting__list',
    summaryKey: 'setting_summary_list',
    icon: 'love',
    group: 'setting_group_library',
  },
  {
    id: 'SettingSearch',
    titleKey: 'setting__search',
    summaryKey: 'setting_summary_search',
    icon: 'search-2',
    group: 'setting_group_library',
  },
  {
    id: 'SettingDownload',
    titleKey: 'setting__download',
    summaryKey: 'setting_summary_download',
    icon: 'download-2',
    group: 'setting_group_library',
  },
  {
    id: 'SettingSync',
    titleKey: 'setting__sync',
    summaryKey: 'setting_summary_sync',
    icon: 'share',
    group: 'setting_group_library',
    quickAnchors: [
      { section: 'cloud-library', labelKey: 'setting__sync_cloud_title' },
      { section: 'sync_mode', labelKey: 'setting__sync_mode' },
    ],
  },
  {
    id: 'SettingBackup',
    titleKey: 'setting__backup',
    summaryKey: 'setting_summary_backup',
    icon: 'sdCard',
    group: 'setting_group_library',
  },
  {
    id: 'SettingOpenAPI',
    titleKey: 'setting__open_api',
    summaryKey: 'setting_summary_open_api',
    icon: 'audio-wave',
    group: 'setting_group_app',
    quickAnchors: [
      { section: 'setting_open_api_enable', labelKey: 'obs_browser_source' },
      { section: 'live_requests', labelKey: 'live_requests' },
      { section: 'discord_enable', labelKey: 'discord_activity' },
    ],
  },
  {
    id: 'SettingNetwork',
    titleKey: 'setting__network',
    summaryKey: 'setting_summary_network',
    icon: 'tune-variant',
    group: 'setting_group_app',
  },
  {
    id: 'SettingOther',
    titleKey: 'setting__other',
    summaryKey: 'setting_summary_other',
    icon: 'setting',
    group: 'setting_group_app',
  },
  {
    id: 'SettingUpdate',
    titleKey: 'setting__update',
    summaryKey: 'setting_summary_update',
    icon: 'refresh',
    group: 'setting_group_app',
  },
  {
    id: 'SettingAbout',
    titleKey: 'setting__about',
    summaryKey: 'setting_summary_about',
    icon: 'information-slab-circle-outline',
    group: 'setting_group_app',
  },
]

export const SETTING_SEARCH_ENTRIES: readonly SettingSearchEntry[] = [
  { section: 'setting_show_animate', tab: 'SettingBasic', titleKey: 'setting__basic_show_animation', keywords: '动画 动画效果 性能 流畅 animation performance fullscreen tray' },
  { section: 'basic_theme', tab: 'SettingBasic', titleKey: 'theme_appearance', keywords: '外观 浅色 深色 暗黑 自动 主题 配色 cover palette layout ark relived elaina theme dark light' },
  { section: 'desktop_layout', tab: 'SettingBasic', titleKey: 'desktop_layout', keywords: '桌面 布局 ark relive elaina motheme microrange transmission unbounded layout' },
  { section: 'basic_glass', tab: 'SettingBasic', titleKey: 'setting__basic_glass', keywords: '毛玻璃 液态玻璃 模糊 背景图 透明 预设 glass blur background opacity' },
  { section: 'style-snippets', tab: 'SettingBasic', titleKey: 'style_snippets', keywords: 'css 样式 片段 自定义 注入 代码 snippet style' },
  { section: 'better_plugins', tab: 'SettingBasic', titleKey: 'better_plugins', keywords: '插件 扩展 betterncm 市场 安装 调试 plugin extension marketplace' },
  { section: 'basic_source', tab: 'SettingBasic', titleKey: 'setting__basic_source', keywords: '音源 接口 脚本 自定义源 导入 source user api' },
  { section: 'basic_interface_zoom', tab: 'SettingBasic', titleKey: 'interface_zoom', keywords: '缩放 窗口大小 字体 字号 语言 zoom size font language' },
  { section: 'basic_font_size', tab: 'SettingBasic', titleKey: 'setting__basic_font_size', keywords: '字体大小 字号 font size' },
  { section: 'basic_lang', tab: 'SettingBasic', titleKey: 'setting__basic_lang', keywords: '语言 中文 英文 繁体 language locale' },
  { section: 'hot_key', tab: 'SettingHotKey', titleKey: 'setting__hot_key', keywords: '快捷键 全局 局部 热键 按键 hotkey shortcut keybinding' },
  { section: 'keyboard_seek', tab: 'SettingPlay', titleKey: 'keyboard_seek', keywords: '键盘 快进 快退 方向键 seek keyboard' },
  { section: 'crossfade_seconds', tab: 'SettingPlay', titleKey: 'crossfade_seconds', keywords: '交叉 淡入 淡出 切歌 无缝 crossfade' },
  { section: 'setting_player_footer_lyric', tab: 'SettingPlay', titleKey: 'setting__play_footer_lyric', keywords: '底部 播放栏 歌词 玻璃 双语 罗马音 footer lyric' },
  { section: 'basic_play_quality', tab: 'SettingPlay', titleKey: 'setting__play_playQuality', keywords: '音质 无损 flac hi-res 试听 quality' },
  { section: 'play_fallback', tab: 'SettingPlay', titleKey: 'playback_fallback_title', keywords: '智能换源 备用 音源 兜底 fallback' },
  { section: 'play_mediaDevice', tab: 'SettingPlay', titleKey: 'setting__play_mediaDevice', keywords: '输出设备 声卡 耳机 音频设备 device output' },
  { section: 'play_detail', tab: 'SettingPlayDetail', titleKey: 'setting__play_detail', keywords: '播放详情 沉浸 经典 布局 歌词字号 边缘渐隐 play detail immersive' },
  { section: 'lyric_furigana', tab: 'SettingPlayDetail', titleKey: 'lyric_furigana', keywords: '日语 假名 注音 振假名 读音 离线 furigana japanese' },
  { section: 'model-lyrics', tab: 'SettingPlayDetail', titleKey: 'model_lyrics', keywords: 'ai 大模型 翻译 批量 歌词 openai key model translation' },
  { section: 'lyric_dictionary', tab: 'SettingPlayDetail', titleKey: 'lyric_dictionary', keywords: '词典 日语 单词 查词 yomitan anki dictionary' },
  { section: 'lyric_arrangement', tab: 'SettingPlayDetail', titleKey: 'lyric_arrangement', keywords: '歌词排列 顺序 原文 译文 罗马音 arrangement' },
  { section: 'play_detail_video', tab: 'SettingPlayDetail', titleKey: 'detail_video', keywords: '视频 动态封面 mv b站 bilibili video background' },
  { section: 'play_detail_visualization', tab: 'SettingPlayDetail', titleKey: 'setting__play_detail_visualization', keywords: '可视化 音频 频谱 律动 visualizer spectrum' },
  { section: 'desktop_lyric', tab: 'SettingDesktopLyric', titleKey: 'setting__desktop_lyric', keywords: '桌面歌词 悬浮 任务栏 字体 颜色 行距 desktop taskbar lyric' },
  { section: 'taskbar_lyrics', tab: 'SettingDesktopLyric', titleKey: 'taskbar_lyrics', keywords: '任务栏 歌词 windows taskbar lyric' },
  { section: 'odc', tab: 'SettingOdc', titleKey: 'setting__odc', keywords: 'odc 外部 音频 音效 均衡器' },
  { section: 'list', tab: 'SettingList', titleKey: 'setting__list', keywords: '列表 歌单 添加 队列 收藏 默认 历史 上限 list queue history' },
  { section: 'search', tab: 'SettingSearch', titleKey: 'setting__search', keywords: '搜索 历史记录 热搜 聚焦 search history hot' },
  { section: 'download_path', tab: 'SettingDownload', titleKey: 'setting__download', keywords: '下载 目录 路径 保存 命名 并发 内嵌 歌词 封面 download path lrc' },
  { section: 'cloud-library', tab: 'SettingSync', titleKey: 'setting__sync_cloud_title', keywords: '云盘 云端 曲库 s3 r2 webdav 同步 账号 cloud sync' },
  { section: 'sync_mode', tab: 'SettingSync', titleKey: 'setting__sync_mode', keywords: '局域网 同步 服务端 客户端 连接码 sync server client' },
  { section: 'backup', tab: 'SettingBackup', titleKey: 'setting__backup', keywords: '备份 恢复 导入 导出 csv txt backup restore' },
  { section: 'setting_open_api_enable', tab: 'SettingOpenAPI', titleKey: 'obs_browser_source', keywords: 'openapi http 端口 obs 直播 浏览器源 叠加层 overlay api' },
  { section: 'steam_presence', tab: 'SettingOpenAPI', titleKey: 'steam_presence', keywords: 'steam 状态 正在玩 qr 扫码 presence' },
  { section: 'live_requests', tab: 'SettingOpenAPI', titleKey: 'live_requests', keywords: 'b站 直播 弹幕 点歌 live bilibili' },
  { section: 'discord_enable', tab: 'SettingOpenAPI', titleKey: 'discord_activity', keywords: 'discord 状态 rpc activity' },
  { section: 'amll_enable', tab: 'SettingOpenAPI', titleKey: 'receiver_title', keywords: 'amll 6k labs lyricsisland skyloong 键盘屏 外部歌词 websocket' },
  { section: 'network', tab: 'SettingNetwork', titleKey: 'setting__network', keywords: '网络 代理 http socks proxy' },
  { section: 'other', tab: 'SettingOther', titleKey: 'setting__other', keywords: '其他 托盘 清理 缓存 不喜欢 黑名单 cache tray dislike' },
  { section: 'update', tab: 'SettingUpdate', titleKey: 'setting__update', keywords: '更新 版本 下载 镜像 update' },
  { section: 'about', tab: 'SettingAbout', titleKey: 'setting__about', keywords: '关于 开源 帮助 协议 about' },
]

export const matchSettingEntries = (
  query: string,
  t: (key: string) => string,
): Array<SettingSearchEntry & { tabTitle: string }> => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  const tokens = normalized.split(/\s+/).filter(Boolean)
  const tabTitleMap = new Map(SETTING_TABS.map(tab => [tab.id, t(tab.titleKey)]))
  return SETTING_SEARCH_ENTRIES
    .map(entry => ({
      ...entry,
      tabTitle: tabTitleMap.get(entry.tab) ?? entry.tab,
      haystack: `${t(entry.titleKey)} ${tabTitleMap.get(entry.tab) ?? ''} ${entry.keywords}`.toLowerCase(),
    }))
    .filter(entry => tokens.every(token => entry.haystack.includes(token)))
}

export const focusSettingSection = (section: string, contentEl?: HTMLElement | null): void => {
  const content = contentEl ?? document.getElementById('setting-panel')
  const target = document.getElementById(section)
  if (!target || !content?.contains(target)) return
  for (let node: HTMLElement | null = target; node && node !== content; node = node.parentElement) {
    if (node.tagName === 'DETAILS') (node as HTMLDetailsElement).open = true
  }
  content.scrollBy({
    top: target.getBoundingClientRect().top - content.getBoundingClientRect().top - 16,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
  target.focus({ preventScroll: true })
  target.setAttribute('data-setting-highlight', 'true')
  setTimeout(() => { target.removeAttribute('data-setting-highlight') }, 1500)
}
