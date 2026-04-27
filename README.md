# 🎵 Versior AI 电台

> 赛博朋克风格 AI 音乐电台 · 智能推荐 · 多平台歌单同步 · 天气感知

## ✨ 特性

- 🤖 **AI DJ** — AI 驱动，自然语言对话点歌
- 🎨 **赛博朋克 UI** — 像素字体、呼吸灯、暗色主题
- 🎵 **多平台支持** — 网易云、酷我、QQ音乐、酷狗
- 🌤️ **天气感知** — 根据天气推荐适合的音乐
- 📱 **响应式** — 桌面端 + 移动端完美适配
- 🐳 **一键部署** — Docker Compose 一键启动
- 🌐 **公网就绪** — 内置 nginx 配置 + WebSocket 支持

## 📋 版本更新

### v1.0.14 (2026-04-27)
- 🔧 修复：搜索优先用 NeteaseCloudMusicApi 代理容器，回退 weapi 加密
- 🔧 修复：docker-compose 新增 netease-api 代理容器

### v1.0.13 (2026-04-27)
- 🔧 修复：网易云搜索/播放链接/详情/热评全部改为 weapi 加密接口

### v1.0.12 (2026-04-27)
- 🔧 修复：天气数据通过 WS 发送给前端

### v1.0.11 (2026-04-27)
- 🔧 修复：登录状态显示逻辑（自动刷新不触发错误提示）

### v1.0.10 (2026-04-27)
- 🔧 修复：网易云/QQ音乐接口改为官方 API（第三方代理已下线）
- 🔧 修复：各平台 baseUrl 改为各自官方域名

### v1.0.9 (2026-04-27)
- 🔧 修复：网易云登录状态显示（前端判断字段 + 后端返回 loggedIn）
- 🔧 修复：README 添加版本更新日志

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

### 方式一：Docker 一键部署（推荐）

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd versior-radio

# 2. 配置环境变量
cp backend/.env.example data/.env
# 编辑 data/.env，填入 API Key 和管理员密码

# 3. 一键启动
docker compose up -d

# 4. 访问
# 内网: http://localhost:8834
```

### 方式二：手动部署

```bash
# 后端
cd backend
cp .env.example .env
# 编辑 .env
npm install
node src/server.js

# 前端（开发模式）
cd frontend
npm install
npm run dev
```

### 方式三：公网部署（Docker + Nginx + SSL）

```bash
# 1. 启动服务
docker compose up -d

# 2. 配置 nginx
cp nginx.conf /etc/nginx/conf.d/versior.conf
# 修改 server_name 为你的域名
nginx -t && nginx -s reload

# 3. 申请 SSL 证书
certbot --nginx -d your-domain.com

# 4. 访问
# https://your-domain.com
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
│   │   └── user-music-prefs.json  # 用户偏好
│   ├── package.json
│   └── .env.example        # 环境变量模板
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # 主应用
│   │   ├── index.css       # 全局样式
│   │   └── main.jsx        # 入口
│   ├── public/
│   │   └── fonts/          # 本地字体
│   └── package.json
├── Dockerfile              # Docker 构建
├── docker-compose.yml      # Docker Compose
├── nginx.conf              # Nginx 配置模板
└── README.md
```

## ⚙️ 配置说明

### 环境变量（backend/.env）

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `PORT` | 否 | 8834 | 服务端口 |
| `ADMIN_PASSWORD` | 是 | - | 管理员密码 |
| `LONGCAT_API_KEY` | 是 | - | AI API Key |
| `LONGCAT_API_URL` | 是 | - | AI API 地址（**无默认值，必须填写**） |
| `LONGCAT_MODEL` | 是 | - | AI 模型（**无默认值，必须填写**） |
| `MUSIC_API_URL` | 是 | - | 音乐搜索 API（**无默认值，必须填写**） |
| `MUSIC_SOURCE` | 否 | netease | 默认音乐源 |
| `NETEASE_COOKIE` | 否 | - | 网易云 Cookie |

### 前端配置页面

访问电台 → 点击右上角「设置」→ 输入管理员密码 → 「配置」Tab

可配置项：
- AI API URL / Key / 模型
- 音乐 API URL
- 音乐源选择

## 🌐 部署场景

### 内网/本地部署
```bash
docker compose up -d
# 访问: http://localhost:8834
```

### 公网部署（单端口）
```bash
# 服务器防火墙开放 8834 端口
docker compose up -d
# 访问: http://your-server-ip:8834
```

### 公网部署（Nginx + SSL）
```bash
# 1. 启动 Docker
docker compose up -d

# 2. 配置 nginx（见 nginx.conf）
# 3. 申请 SSL: certbot --nginx -d your-domain.com
# 访问: https://your-domain.com
```

## 🐳 多架构 Docker 构建

镜像支持 `linux/amd64` 和 `linux/arm64`（树莓派 / Apple Silicon）。

```bash
# 登录 Docker Hub
docker login

# 创建 buildx 构建器（首次）
docker buildx create --use --name multiarch 2>/dev/null || true

# 构建 + 推送 amd64 + arm64
docker buildx build --platform linux/amd64,linux/arm64 \
  -t versior/ai:latest --push .

# 仅构建当前架构（本地测试）
docker build -t versior/ai:latest .
```

## 🔧 开发

```bash
# 后端开发
cd backend && node src/server.js

# 前端开发
cd frontend && npm run dev

# 构建前端
cd frontend && npm run build
```

## 📝 注意事项

1. **首次使用**：需要配置 AI API Key、API URL、模型名称和音乐 API（在 .env 或前端设置页面）
2. **必填项无默认值**：`LONGCAT_API_URL`、`LONGCAT_MODEL`、`MUSIC_API_URL` 必须手动填写
3. **管理员密码**：默认 `versior123`，首次登录后请在设置页「密码」Tab 修改
4. **音乐平台登录**：在设置页面「音乐登录」Tab 配置
5. **网易云/酷我**：支持账号密码或 Cookie 登录
6. **QQ音乐/酷狗**：仅支持 Cookie 登录
7. **音频播放**：浏览器直接请求 CDN，无需代理
8. **WebSocket**：自动适配 HTTP/HTTPS

## 📄 许可证

MIT
