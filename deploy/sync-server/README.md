# Q-music 多端同步服务

该部署配置使用与 Q-music 桌面端、Android 客户端兼容的 LX Music Sync Server，
用于在 Windows、Arch Linux 与 Android 之间自动同步歌单和“不喜欢”列表。

## 部署

1. 复制 `.env.example` 为 `.env`，把 `QMUSIC_SYNC_PASSWORD` 改成长随机连接码。
2. 执行 `docker compose up -d`。
3. 使用 Caddy、Nginx 等反向代理到 `127.0.0.1:9527`，公网使用时必须启用可信 HTTPS。
4. 在各端“设置 → Q-music 云同步”中填写 `https://你的域名`。
5. 首次连接时输入 `.env` 中的连接码，之后设备会安全缓存认证密钥并自动重连。

默认账号名为 `qmusic`。服务端使用连接码识别账号，客户端不需要单独输入用户名。
如需多个账号，可在 `docker-compose.yml` 中增加不同的 `LX_USER_<用户名>` 环境变量，
每个账号的连接码必须唯一。

同步数据保存在 `data/`，日志保存在 `logs/`。升级或迁移前请备份 `data/`。
