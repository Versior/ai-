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

## 🚀 快速部署

### 前置要求

- Docker + Docker Compose
- 网易云音乐 Cookie（用于搜索和播放）

### 部署步骤

1. **克隆项目**

```bash
git clone https://github.com/Versior/ai-.git
cd ai-
```

2. **配置环境变量**

编辑 `backend/.env`：

```env
LONGCAT_API_KEY=你的LongCat API密钥
NETEASE_COOKIE=你的网易云Cookie
ADMIN_PASSWORD=你的管理员密码
```

3. **启动服务**

```bash
cd /opt/versior-radio
docker compose up -d
```

4. **访问电台**

打开浏览器访问 `http://服务器IP:8834`

### 更新

```bash
cd /opt/versior-radio
docker compose pull
docker compose down
docker compose up -d
```

### 查看日志

```bash
docker compose logs -f
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
| LONGCAT_API_KEY | ✅ | LongCat API 密钥 |
| NETEASE_COOKIE | ✅ | 网易云音乐 Cookie |
| LONGCAT_MODEL | ❌ | LLM 模型名称，默认 LongCat-Flash-Lite |
| MUSIC_SOURCE | ❌ | 默认音乐平台，默认 netease |
| ADMIN_PASSWORD | ❌ | 管理员密码，默认 versior123 |
| PORT | ❌ | 服务端口，默认 8834 |

## 📝 更新日志

见 [CHANGELOG.md](./CHANGELOG.md)

## 📄 协议

MIT License
