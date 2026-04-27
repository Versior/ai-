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
│   │   ├── server.js       # 主服务器（HTTP + WebSocket）
│   │   ├── llm.js          # LLM 服务（AI 大脑）
│   │   ├── music.js        # 音乐服务（搜索/播放/详情/热评）
│   │   └── weather.js      # 天气服务
│   ├── package.json
│   └── .env                # 环境变量配置
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # 前端主界面
│   │   └── main.jsx        # 入口文件
│   ├── package.json
│   └── index.html
├── docker-compose.yml
├── Dockerfile
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
| ADMIN_PASSWORD | ❌ | 管理员密码，默认 versior123 |
| MUSIC_SOURCE | ❌ | 默认音乐平台，默认 netease |
| PORT | ❌ | 服务端口，默认 8834 |

> 💡 所有 LLM 配置也可以在前端设置页面（⚙️ 配置 → 配置）中填写，无需重启服务。

## 📝 更新日志

见 [CHANGELOG.md](./CHANGELOG.md)

## 📄 协议

MIT License
