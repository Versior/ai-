# 🎵 Versior AI 电台

> 赛博朋克风格 AI 音乐电台 · AI 智能推荐 · 多平台歌单同步 · 天气感知

## ✨ 特性

- 🤖 **AI DJ** — AI 驱动，根据天气和心情推荐音乐
- 🎨 **赛博朋克 UI** — 像素字体、呼吸灯、暗色主题
- 🎵 **多平台支持** — 网易云、酷我、QQ音乐、酷狗
- 🌤️ **天气感知** — 根据天气推荐适合的音乐
- 📱 **响应式** — 桌面端 + 移动端完美适配
- 🐳 **Docker 部署** — 一键启动

## 📋 版本更新

### v1.0.22 (2026-04-27)
- 🔧 修复：搜索接口改用 POST（NeteaseCloudMusicApi /search 只支持 POST）
- 🔧 修复：netease-api 代理容器改为 docker run 单独启动
- 🔧 修复：netease-api 端口改为 9934（避免冲突）
- 🔧 修复：docker-compose 不再管理 netease-api（避免健康检查问题）
- 🔧 修复：this.netease 防御性检查

### v1.0.21 (2026-04-27)
- 🔧 修复：搜索接口路径改为 /cloudsearch

### v1.0.20 (2026-04-27)
- 🔧 修复：搜索接口路径改为 /cloudsearch

### v1.0.19 (2026-04-27)
- 🔧 恢复：NeteaseCloudMusicApi 代理容器（最优方案）
- 🔧 修复：搜索优先用代理 API，失败回退歌单随机选

### v1.0.16 (2026-04-27)
- 🔧 修复：pickRandomFromLibrary 类内部语法错误

### v1.0.15 (2026-04-27)
- 🔧 修复：搜索失败后从用户歌单随机选歌

### v1.0.14 (2026-04-27)
- 🔧 修复：搜索优先用 NeteaseCloudMusicApi 代理容器
- 🔧 修复：docker-compose 新增 netease-api 代理容器

### v1.0.13 (2026-04-27)
- 🔧 修复：网易云接口改为 weapi 加密

### v1.0.12 (2026-04-27)
- 🔧 修复：天气数据通过 WS 发送给前端

### v1.0.11 (2026-04-27)
- 🔧 修复：登录状态显示逻辑

### v1.0.10 (2026-04-27)
- 🔧 修复：网易云/QQ音乐接口改为官方 API

### v1.0.9 (2026-04-27)
- 🔧 修复：网易云登录状态显示

### v1.0.8 (2026-04-27)
- 🔧 修复：WS 断连后自动重连（指数退避，最多 10 次）
- 🔧 修复：切歌在 WS 断开时用 HTTP 兜底
- 🔧 修复：后端 API 路由支持 query string 匹配
- 🔧 修复：前端 API 端口动态获取，不再硬编码
- 🔧 修复：去掉前端页面中具体 AI 模型名称显示
- ✨ 新增：底部显示版本号

### v1.0.7 (2026-04-27)
- 🔧 去掉 LONGCAT_API_URL / LONGCAT_MODEL / MUSIC_API_URL 默认值，改为必填
- ✨ 新增：前端设置页支持修改管理员密码
- 🔧 默认密码改为 versior123
- 📦 Dockerfile 支持多架构构建 + GitHub Actions 自动推送

### v1.0.0 (2026-04-24)
- 🎉 初始版本发布

> 完整日志见 [CHANGELOG.md](CHANGELOG.md)

## 🚀 快速开始

### 前置条件

- Docker + Docker Compose
- AI API Key（如 LongCat）
- 网易云音乐 Cookie（可选，用于搜索和播放链接）

### 1. 克隆项目

```bash
git clone https://github.com/Versior/ai-.git
cd versior-radio
```

### 2. 配置环境变量

```bash
cp backend/.env.example data/.env
```

编辑 `data/.env`，**以下三项必填，无默认值**：

```env
LONGCAT_API_URL=https://your-ai-api-url
LONGCAT_MODEL=your-model-name
MUSIC_API_URL=http://host.docker.internal:9934
```

可选配置：

```env
ADMIN_PASSWORD=versior123
LONGCAT_API_KEY=your-api-key
MUSIC_SOURCE=netease
NETEASE_COOKIE=your-netease-cookie
```

### 3. 启动 NeteaseCloudMusicApi 代理

⚠️ **必须单独用 `docker run` 启动，不要用 docker-compose**：

```bash
docker run -d \
  --name netease-api \
  -p 9934:3000 \
  --restart unless-stopped \
  binaryify/netease_cloud_music_api:latest
```

验证代理是否正常：

```bash
curl -X POST "http://localhost:9934/search" -d "keywords=海阔天空&limit=3"
# 应返回 JSON 数据
```

### 4. 启动 Versior AI 电台

```bash
docker compose up -d
```

### 5. 访问

```
内网: http://localhost:8834
公网: http://your-server-ip:8834
```

## 📁 项目结构

```
versior-radio/
├── backend/
│   ├── src/
│   │   ├── server.js       # HTTP + WS 服务器
│   │   ├── llm.js          # AI 对话服务
│   │   ├── music.js        # 音乐搜索服务
│   │   ├── weather.js      # 天气服务
│   │   └── user-music-prefs.json  # 用户偏好歌曲列表
│   ├── package.json
│   └── .env.example        # 环境变量模板
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # 主应用
│   │   └── index.css       # 全局样式
│   └── package.json
├── Dockerfile              # 多架构 Docker 构建
├── docker-compose.yml      # Docker Compose（仅管理电台容器）
└── README.md
```

## ⚙️ 配置说明

### 环境变量（data/.env）

| 变量 | 必填 | 说明 |
|------|------|------|
| `LONGCAT_API_URL` | ✅ | AI API 地址（无默认值） |
| `LONGCAT_MODEL` | ✅ | AI 模型名称（无默认值） |
| `LONGCAT_API_KEY` | ✅ | AI API Key |
| `MUSIC_API_URL` | ✅ | NeteaseCloudMusicApi 代理地址（无默认值） |
| `ADMIN_PASSWORD` | 否 | 管理员密码（默认 versior123） |
| `MUSIC_SOURCE` | 否 | 默认音乐源（netease/kuwo/qqmusic/kugou） |
| `NETEASE_COOKIE` | 否 | 网易云 Cookie（用于歌单同步和播放链接） |

### 前端设置页面

访问电台 → 点击右上角「设置」→ 输入管理员密码

可配置：
- **配置** Tab：AI API URL / Key / 模型、音乐 API URL
- **音乐登录** Tab：网易云/酷我/QQ音乐/酷狗 登录
- **密码** Tab：修改管理员密码

## 🐳 多架构 Docker 构建

镜像 `versior/ai:latest` 支持 `linux/amd64` 和 `linux/arm64`。

通过 GitHub Actions 自动构建和推送，无需手动操作。

手动构建：

```bash
docker buildx create --use --name multiarch 2>/dev/null || true
docker buildx build --platform linux/amd64,linux/arm64 \
  -t versior/ai:latest --push .
```

## 🔍 常见问题

### 搜索失败 / 无法播放

1. **检查 netease-api 代理是否正常运行**：
   ```bash
   docker ps | grep netease-api
   curl -X POST "http://localhost:9934/search" -d "keywords=测试&limit=1"
   ```

2. **检查 .env 配置**：
   - `MUSIC_API_URL` 必须填写（如 `http://netease-api:3000`）
   - `LONGCAT_API_URL`、`LONGCAT_MODEL`、`LONGCAT_API_KEY` 必须填写

3. **搜索回退机制**：代理搜索失败后，会自动从用户歌单（374首）随机选一首能播放的歌曲

### netease-api 容器启动后立即退出

不要用 docker-compose 管理 netease-api，必须单独用 `docker run` 启动。

### 端口冲突

netease-api 默认使用 9934 端口。如需修改：
```bash
docker run -d --name netease-api -p YOUR_PORT:3000 --restart unless-stopped binaryify/netease_cloud_music_api:latest
```

### 更新镜像

```bash
cd /opt/versior-radio
docker compose pull
docker compose up -d
docker pull binaryify/netease_cloud_music_api:latest
docker restart netease-api
```

## 📄 许可证

MIT
