# 🎵 Versior AI 神经元电台

赛博朋克风格的 AI 智能电台，支持自然语言对话点歌、多平台音乐播放、天气感知推荐。

## ✨ 功能特性

- 🤖 **AI DJ** — 自然语言对话点歌，AI 生成推荐理由和歌曲风格介绍
- 🎵 **多平台支持** — 网易云音乐、酷我音乐、QQ音乐、酷狗音乐
- 🌤️ **天气感知** — 根据天气智能推荐歌曲风格
- 📱 **响应式设计** — 支持桌面端和移动端
- 🔄 **自动预加载** — 播放到 80% 时自动预加载下一首
- 💬 **实时聊天** — WebSocket 实时通信
- 🎨 **赛博朋克 UI** — 霓虹色调，像素字体
- 💡 **发现新音乐** — AI 优先推荐歌单外的歌曲，帮你发现新音乐
- 🔀 **亮色/暗色主题** — 支持一键切换

## 🚀 Docker 部署（推荐）

### 前置要求

- Docker + Docker Compose
- 网易云音乐 Cookie（用于搜索和播放）

### 方式一：使用 Docker Hub 镜像（最简单）

1. **创建数据目录和配置文件**

```bash
mkdir -p /opt/versior-radio/data
```

2. **创建 `docker-compose.yml`**

```yaml
services:
  versior-radio:
    image: versior/ai:latest
    container_name: versior-radio
    network_mode: host
    volumes:
      - ./data/.env:/app/backend/.env
      - ./data/user-music-prefs.json:/app/backend/src/user-music-prefs.json
      - ./data/logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=8834
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8834/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
```

3. **创建 `data/.env`**

```env
# === LLM 配置（必填） ===
# 支持任何兼容 OpenAI 格式的 API（LongCat、OpenAI、DeepSeek 等）
LONGCAT_API_KEY=你的API密钥
LONGCAT_API_URL=https://你的API地址/v1/chat/completions
LONGCAT_MODEL=你的模型名称

# === 管理员密码 ===
ADMIN_PASSWORD=versior123

# === 音乐平台配置 ===
MUSIC_SOURCE=netease

# 网易云 Cookie（必填，用于搜索/播放链接/详情/热评）
# 获取方式：浏览器登录 music.163.com → F12 → Application → Cookies → 复制
NETEASE_COOKIE=你的网易云Cookie
```

4. **启动服务**

```bash
cd /opt/versior-radio
docker compose up -d
```

5. **访问电台**

打开浏览器访问 `http://服务器IP:8834`

### 方式二：本地构建

```bash
git clone https://github.com/Versior/ai-.git
cd ai-

# 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env 填写配置

# 构建并启动
docker compose up -d --build
```

### 方式三：多架构构建（amd64 + arm64）

```bash
docker buildx create --use --name multiarch 2>/dev/null || true
docker buildx build --platform linux/amd64,linux/arm64 \
  -t versior/ai:latest --push .
```

### 常用命令

```bash
# 更新到最新版本
docker compose pull && docker compose down && docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart
```

## 📁 项目结构

```
versior-radio/
├── backend/
│   ├── src/
│   │   ├── server.js          # 主服务器（HTTP + WebSocket + 路由）
│   │   ├── llm.js             # LLM 服务（AI 大脑）
│   │   ├── weather.js         # 天气服务
│   │   ├── music/             # 音乐平台服务
│   │   │   ├── index.js       # 统一门面（多平台路由）
│   │   │   ├── netease.js     # 网易云音乐
│   │   │   ├── kuwo.js        # 酷我音乐
│   │   │   ├── qqmusic.js     # QQ音乐
│   │   │   └── kugou.js       # 酷狗音乐
│   │   └── routes/            # API 路由
│   │       ├── health.js      # 健康检查
│   │       ├── config.js      # 配置读写/改密
│   │       ├── music.js       # 音乐登录/状态/刷新
│   │       └── search.js      # 搜索/AI总结
│   ├── package.json
│   └── .env                   # 环境变量配置
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # 前端主界面
│   │   ├── main.jsx           # 入口文件
│   │   └── components/
│   │       └── IntroModal.jsx # 关于弹窗
│   ├── package.json
│   └── index.html
├── docker-compose.yml
├── Dockerfile
├── REFACTOR_PLAN.md
└── CHANGELOG.md
```

## 🔧 开发

### 后端开发

```bash
cd backend
npm install
node src/server.js
```

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

### 构建前端

```bash
cd frontend
npm run build
```

## 📋 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| LONGCAT_API_KEY | ✅ | LLM API 密钥 |
| LONGCAT_API_URL | ✅ | LLM API 地址（支持任何 OpenAI 格式） |
| LONGCAT_MODEL | ✅ | LLM 模型名称 |
| NETEASE_COOKIE | ✅ | 网易云音乐 Cookie |
| KUWO_COOKIE | ❌ | 酷我音乐 Cookie |
| QQMUSIC_COOKIE | ❌ | QQ音乐 Cookie |
| KUGOU_COOKIE | ❌ | 酷狗音乐 Cookie |
| ADMIN_PASSWORD | ❌ | 管理员密码，默认 versior123 |
| MUSIC_SOURCE | ❌ | 默认音乐平台，默认 netease |
| PORT | ❌ | 服务端口，默认 8834 |

> 💡 所有 LLM 配置也可以在前端设置页面（⚙️ 配置 → 配置）中填写，无需重启服务。
> 💡 搜索和播放链接使用**网易云官方 API**，不依赖第三方代理。

## 📝 更新日志

### v1.2.3 (2026-04-28)
- IntroModal 响应主题切换（亮色/暗色自适应）

### v1.2.2 (2026-04-28)
- 默认主题改为亮色
- 恢复 IntroModal 像素风格 + 作者信息 + 主页链接

### v1.2.1 (2026-04-28)
- 修复点击播放列表/搜索结果不播放的问题
- 修复音频 URL 失效后恢复播放失败

### v1.2.0 (2026-04-28)
- 恢复多平台支持（酷我、QQ音乐、酷狗）
- LLM prompt 优化：优先推荐歌单外歌曲

### v1.1.0 (2026-04-28)
- 后端重构：music.js 拆分为独立平台文件 + 路由模块化
- 前端重构：提取 IntroModal 组件

见 [CHANGELOG.md](./CHANGELOG.md) 查看完整日志

## 📄 协议

MIT License
