# 🎵 Versior AI 电台

> 赛博朋克风格 AI 音乐电台 · 智能推荐 · 多平台歌单同步 · 天气感知

## ✨ 特性

- 🤖 **AI DJ** — LongCat-Flash-Lite 驱动，自然语言对话点歌
- 🎨 **赛博朋克 UI** — 像素字体、呼吸灯、暗色主题
- 🎵 **多平台支持** — 网易云、酷我、QQ音乐、酷狗
- 🌤️ **天气感知** — 根据天气推荐适合的音乐
- 📱 **响应式** — 桌面端 + 移动端完美适配
- 🐳 **一键部署** — Docker Compose 一键启动
- 🌐 **公网就绪** — 内置 nginx 配置 + WebSocket 支持

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
| `LONGCAT_API_URL` | 否 | longcat.chat | AI API 地址 |
| `LONGCAT_MODEL` | 否 | LongCat-Flash-Lite | AI 模型 |
| `MUSIC_API_URL` | 否 | iwenwiki.com:3000 | 音乐搜索 API |
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

1. **首次使用**：需要配置 AI API Key（在 .env 或前端设置页面）
2. **音乐平台登录**：在设置页面「音乐登录」Tab 配置
3. **网易云/酷我**：支持账号密码或 Cookie 登录
4. **QQ音乐/酷狗**：仅支持 Cookie 登录
5. **音频播放**：浏览器直接请求 CDN，无需代理
6. **WebSocket**：自动适配 HTTP/HTTPS

## 📄 许可证

MIT
