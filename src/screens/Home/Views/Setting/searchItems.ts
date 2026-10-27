import type { ComponentType } from 'react'
import type { SettingScreenIds } from './Main'
import type { SettingLabel } from './searchMatch'
import Control0 from './settings/Download'
import Control1 from './settings/Basic/Source'
import Control2 from './settings/Basic/SourceName'
import Control3 from './settings/Theme/IsAutoTheme'
import Control4 from './settings/Theme/Theme'
import Control5 from './settings/Theme/IsDynamicBg'
import Control6 from './settings/Theme/IsHideBgDark'
import Control7 from './settings/Theme/BlurLevel'
import Control8 from './settings/Theme/PerformanceMode'
import Control9 from './settings/Theme/IsFontShadow'
import Control10 from './settings/Basic/FontSize'
import Control11 from './settings/Basic/DisplayMode'
import Control12 from '@/components/player/PlayerStyleSelector'
import Control13 from './settings/Player/PlayHighQuality'
import Control14 from './settings/Basic/IsStartupAutoPlay'
import Control15 from './settings/Basic/IsStartupPushPlayDetailScreen'
import Control16 from './settings/Player/IsSavePlayTime'
import Control17 from './settings/Player/IsAutoCleanPlayedList'
import Control18 from './settings/Player/MaxCache'
import Control19 from '@/components/player/LyricFontSelector'
import Control20 from './settings/Player/IsShowLyricTranslation'
import Control21 from './settings/Player/IsShowLyricRoma'
import Control22 from './settings/Player/IsS2T'
import Control23 from './settings/Player/StatusBarLyric'
import Control24 from './settings/Player/IsShowBluetoothLyric'
import Control25 from './settings/Player/IsShowBluetoothFullLyric'
import Control26 from './settings/Player/BackgroundPlayback'
import Control27 from './settings/Player/IsShowNotificationImage'
import Control28 from './settings/Player/IsHandleAudioFocus'
import Control29 from './settings/Player/IsEnableAudioOffload'
import Control30 from './settings/Basic/Language'
import Control31 from './settings/Basic/IsAutoHidePlayBar'
import Control32 from './settings/Basic/IsHomePageScroll'
import Control33 from './settings/Basic/IsAllowProgressBarSeek'
import Control34 from './settings/Basic/IsUseSystemFileSelector'
import Control35 from './settings/Basic/IsAlwaysKeepStatusbarHeight'
import Control36 from './settings/Basic/ShareType'
import Control37 from './settings/Search/IsShowHistorySearch'
import Control38 from './settings/Search/IsShowHotSearch'
import Control39 from './settings/List/SinglePlayMode'
import Control40 from './settings/List/IsShowAlbumName'
import Control41 from './settings/List/IsShowInterval'
import Control42 from './settings/List/AddMusicLocationType'
import Control43 from './settings/Cloud'
import Control44 from './settings/Sync'
import Control45 from './settings/Backup'
import Control46 from './settings/Other/ResourceCache'
import Control47 from './settings/Other/MetaCache'
import Control48 from './settings/Other/DislikeList'
import Control49 from './settings/Other/Log'
import Control50 from './settings/Version'
import Control51 from './settings/About'
import Control52 from './AccountEntry'
import PredictiveBack from './settings/Basic/PredictiveBack'
import LargeScreenNavigation from './settings/Basic/LargeScreenNavigation'
import LiquidGlass from './settings/Theme/LiquidGlass'

interface SettingSearchItem {
  id: string
  title: SettingLabel
  section: SettingScreenIds
  keywords: string
  component: ComponentType
  standalone?: boolean
  largeScreenOnly?: boolean
}

// 搜索结果复用原设置控件，避免维护两套保存逻辑。
export const SETTINGS_SEARCH_ITEMS: SettingSearchItem[] = [
  { id: 'Theme/LiquidGlass', title: 'setting_liquid_glass', section: 'appearance', keywords: '液态玻璃 液態玻璃 底栏 底欄 迷你 播放条 卡顿 卡頓 性能 glass blur performance', component: LiquidGlass },
  { id: 'Basic/PredictiveBack', title: 'setting_predictive_back', section: 'appearance', keywords: '预测性返回 預測性返回 手势 返回 跟手 回弹 动画 手勢 動畫 gesture predictive back', component: PredictiveBack },
  { id: 'Accounts', title: 'setting_accounts_entry', section: 'basic', keywords: 'QQ 微信 网易云 酷狗 登录 歌单 平台 賬號 登入 網易雲 賬戶 微信 account login kugou netease', component: Control52, standalone: true },
  { id: 'Download', title: 'download_directory', section: 'download', keywords: '目录 路径 保存位置 下载位置 下载路径 下载目录 下载文件夹 存储 下载 資料夾 下載 儲存 目錄 storage folder path location', component: Control0, standalone: true },
  { id: 'Basic/Source', title: 'setting_basic_source', section: 'sources', keywords: '音源 接口 脚本 主源 备用 備用 腳本 api source fallback', component: Control1 },
  { id: 'Basic/SourceName', title: 'setting_basic_sourcename', section: 'sources', keywords: '来源 來源 source name', component: Control2 },
  { id: 'Theme/IsAutoTheme', title: 'theme_appearance', section: 'appearance', keywords: '白天 夜间 深色 暗黑 自动 跟随系统 时间 自動 跟隨系統 時間 dark light time schedule', component: Control3 },
  { id: 'Theme/Theme', title: 'setting_basic_theme', section: 'appearance', keywords: '颜色 配色 背景 顏色 background color theme', component: Control4 },
  { id: 'Theme/IsDynamicBg', title: 'setting_basic_theme_dynamic_bg', section: 'appearance', keywords: '动态 動態 animation', component: Control5 },
  { id: 'Theme/IsHideBgDark', title: 'setting_basic_theme_hide_bg_dark', section: 'appearance', keywords: '遮罩 背景', component: Control6 },
  { id: 'Theme/BlurLevel', title: 'setting_basic_theme_blur_level', section: 'appearance', keywords: '玻璃 模糊 glass blur', component: Control7 },
  { id: 'Theme/PerformanceMode', title: 'setting_basic_theme_performance_mode', section: 'appearance', keywords: '性能 流畅 流暢 省电 省電 performance', component: Control8 },
  { id: 'Theme/IsFontShadow', title: 'setting_basic_theme_font_shadow', section: 'appearance', keywords: '文字 阴影 陰影 shadow', component: Control9 },
  { id: 'Basic/FontSize', title: 'setting_basic_font_size', section: 'appearance', keywords: '字 字体 字體 大小 font size', component: Control10 },
  { id: 'Basic/LargeScreenNavigation', title: 'setting_large_navigation', section: 'appearance', keywords: '导航 位置 左侧 右侧 底部 平板 车机 退出 導航 車機 navigation position left right bottom exit', component: LargeScreenNavigation, largeScreenOnly: true },
  { id: 'Basic/DisplayMode', title: 'setting_display_mode', section: 'appearance', keywords: '手机 平板 车机 手機 車機 tablet car layout', component: Control11 },
  { id: '@/components/player/PlayerStyleSelector', title: 'player_appearance_title', section: 'player', keywords: 'apple 经典 沉浸 經典 封面 歌词 歌詞 style', component: Control12 },
  { id: 'Player/PlayHighQuality', title: 'setting_play_play_quality', section: 'player', keywords: '音质 音質 flac 无损 無損 quality', component: Control13 },
  { id: 'Basic/IsStartupAutoPlay', title: 'setting_basic_startup_auto_play', section: 'player', keywords: '启动 啟動 startup', component: Control14 },
  { id: 'Basic/IsStartupPushPlayDetailScreen', title: 'setting_basic_startup_push_play_detail_screen', section: 'player', keywords: '启动 啟動 startup', component: Control15 },
  { id: 'Player/IsSavePlayTime', title: 'setting_player_save_play_time', section: 'player', keywords: '进度 記憶 進度 resume progress', component: Control16 },
  { id: 'Player/IsAutoCleanPlayedList', title: 'setting_play_auto_clean_played_list', section: 'player', keywords: '队列 隊列 queue', component: Control17 },
  { id: 'Player/MaxCache', title: 'setting_play_cache_size', section: 'player', keywords: '缓存 缓冲 緩存 緩衝 cache size', component: Control18 },
  { id: '@/components/player/LyricFontSelector', title: 'lyric_font_title', section: 'lyrics', keywords: '字体 字體 字号 字號 font', component: Control19 },
  { id: 'Player/IsShowLyricTranslation', title: 'setting_play_show_translation', section: 'lyrics', keywords: '歌词 双语 翻译 中文 对照 歌詞 雙語 翻譯 對照 bilingual translation', component: Control20 },
  { id: 'Player/IsShowLyricRoma', title: 'setting_play_show_roma', section: 'lyrics', keywords: '罗马音 羅馬音 romanization', component: Control21 },
  { id: 'Player/IsS2T', title: 'setting_play_s2t', section: 'lyrics', keywords: '简体 繁体 簡體 繁體 traditional', component: Control22 },
  { id: 'Player/StatusBarLyric', title: 'status_bar_lyric_title', section: 'lyrics', keywords: '状态栏 词幕 狀態欄 詞幕 statusbar lyric', component: Control23 },
  { id: 'Player/IsShowBluetoothLyric', title: 'setting_play_show_bluetooth_lyric', section: 'lyrics', keywords: '蓝牙 藍牙 bluetooth', component: Control24 },
  { id: 'Player/IsShowBluetoothFullLyric', title: 'setting_play_show_bluetooth_full_lyric', section: 'lyrics', keywords: '蓝牙 藍牙 bluetooth', component: Control25 },
  { id: 'Player/BackgroundPlayback', title: 'background_playback_title', section: 'background', keywords: '后台 权限 电池 自启动 無限制 後台 權限 電池 自啟動 battery permission', component: Control26 },
  { id: 'Player/IsShowNotificationImage', title: 'setting_play_show_notification_image', section: 'background', keywords: '通知 封面 notification', component: Control27 },
  { id: 'Player/IsHandleAudioFocus', title: 'setting_play_handle_audio_focus', section: 'background', keywords: '打断 打斷 暂停 暫停 焦点 焦點 focus', component: Control28 },
  { id: 'Player/IsEnableAudioOffload', title: 'setting_play_audio_offload', section: 'background', keywords: '省电 省電 offload', component: Control29 },
  { id: 'Basic/Language', title: 'setting_basic_lang', section: 'basic', keywords: '语言 語言 language', component: Control30 },
  { id: 'Basic/IsAutoHidePlayBar', title: 'setting_basic_auto_hide_play_bar', section: 'basic', keywords: '迷你 播放条 播放條 mini player', component: Control31 },
  { id: 'Basic/IsHomePageScroll', title: 'setting_basic_home_page_scroll', section: 'basic', keywords: '滑动 滑動 swipe', component: Control32 },
  { id: 'Basic/IsAllowProgressBarSeek', title: 'setting_basic_allow_progress_bar_seek', section: 'basic', keywords: '进度 進度 seek', component: Control33 },
  { id: 'Basic/IsUseSystemFileSelector', title: 'setting_basic_use_system_file_selector', section: 'basic', keywords: '选择文件 選擇檔案 picker', component: Control34 },
  { id: 'Basic/IsAlwaysKeepStatusbarHeight', title: 'setting_basic_always_keep_statusbar_height', section: 'basic', keywords: '状态栏 狀態欄 statusbar', component: Control35 },
  { id: 'Basic/ShareType', title: 'setting_basic_share_type', section: 'basic', keywords: '分享 share', component: Control36 },
  { id: 'Search/IsShowHistorySearch', title: 'setting_search_show_history_search', section: 'search', keywords: '历史 历史记录 歷史 記錄 history', component: Control37 },
  { id: 'Search/IsShowHotSearch', title: 'setting_search_show_hot_search', section: 'search', keywords: '热搜 熱搜 hot', component: Control38 },
  { id: 'List/SinglePlayMode', title: 'setting_single_play', section: 'list', keywords: '队列 替换 本地优先 隊列 替換 本地優先 queue local', component: Control39 },
  { id: 'List/IsShowAlbumName', title: 'setting_list_show_album_name', section: 'list', keywords: '专辑 專輯 album', component: Control40 },
  { id: 'List/IsShowInterval', title: 'setting_list_show interval', section: 'list', keywords: '时长 時長 duration', component: Control41 },
  { id: 'List/AddMusicLocationType', title: 'setting_list_add_music_location_type', section: 'list', keywords: '添加位置 頭 尾 position', component: Control42 },
  { id: 'Cloud', title: 'setting_cloud', section: 'cloud', keywords: 's3 webdav r2 上传 下载 导入 加密 金鑰 密钥 雲端 上傳 下載 導入 encryption', component: Control43, standalone: true },
  { id: 'Sync', title: 'setting_sync', section: 'sync', keywords: '局域网 设备 歌单同步 區域網路 裝置 同步 sync', component: Control44, standalone: true },
  { id: 'Backup', title: 'setting_backup', section: 'backup', keywords: '备份 恢复 備份 還原 restore', component: Control45, standalone: true },
  { id: 'Other/ResourceCache', title: 'setting__other_resource_cache', section: 'other', keywords: '清理 图片 圖片 缓存 緩存 cache', component: Control46 },
  { id: 'Other/MetaCache', title: 'setting__other_meta_cache', section: 'other', keywords: '清理 信息 資訊 歌词 缓存 歌詞 緩存 cache', component: Control47 },
  { id: 'Other/DislikeList', title: 'setting__other_dislike_list', section: 'other', keywords: '屏蔽 黑名单 黑名單 不喜欢 不喜歡 dislike', component: Control48 },
  { id: 'Other/Log', title: 'setting_other_log', section: 'other', keywords: '日志 日誌 log debug', component: Control49 },
  { id: 'Version', title: 'setting_version', section: 'version', keywords: '升级 更新 版本 升級 update mirror 镜像 鏡像', component: Control50, standalone: true },
  { id: 'About', title: 'setting_about', section: 'about', keywords: '帮助 帮助说明 幫助 關於 开源 開源 help', component: Control51, standalone: true },
]
