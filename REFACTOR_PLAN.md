# 🔧 Versior Radio 重构 + 功能计划

## 原则
- 先重构，后新功能
- 每一步独立可测试，保证系统不挂
- 重构期间不改功能行为

---

## Phase 1: 后端重构 — 拆分 music.js

### 1.1 创建平台服务基类
`backend/src/music/platform-service.js`
- 抽象基类：cookie 管理、headers、loginWithCookie、checkCookie
- 通用 HTTP 请求方法（带重试）

### 1.2 拆分各平台为独立文件
- `backend/src/music/netease.js` — 网易云（主力，完整功能）
- 其他平台代码保留但不重构（先不管）

### 1.3 创建 MusicService 门面
`backend/src/music/index.js`
- 统一入口，路由到对应平台
- 搜索、获取URL、获取用户数据等方法
- 搜索失败时的随机兜底逻辑

### 1.4 server.js 瘦身
- 路由处理提取到 `backend/src/routes/`
  - `routes/health.js`
  - `routes/config.js`
  - `routes/music.js`
  - `routes/search.js`
- RadioServer 类保留，只负责 WS + 广播 + 播放流程

### 1.5 清理
- 删除 weapi 相关加密代码（确认已不用）
- 删除未使用的平台代码（kuwo/qqmusic/kugou 相关路由和调用）
- 统一错误处理

---

## Phase 2: 前端重构 — 拆分 App.jsx

### 2.1 提取自定义 hooks
- `hooks/useWebSocket.js` — WS 连接、消息处理
- `hooks/useAudio.js` — 音频播放、进度、音量
- `hooks/useWeather.js` — 天气数据

### 2.2 提取 UI 组件
- `components/Player.jsx` — 播放器主体
- `components/Queue.jsx` — 播放队列
- `components/Chat.jsx` — AI 对话区
- `components/Settings.jsx` — 设置页面
- `components/Weather.jsx` — 天气显示
- `components/IntroModal.jsx` — 首次弹窗

### 2.3 App.jsx 变薄
- 只负责组合各组件 + 全局状态

---

## Phase 3: 新功能（重构完成后）

### 3.1 歌词同步显示
- 后端：新增 `/api/lyrics` 接口，从网易云获取歌词
- 前端：`components/Lyrics.jsx`，滚动高亮当前行
- 解析 LRC 格式，时间轴对齐

### 3.2 随机播放模式
- 播放模式：顺序 / 单曲循环 / 随机
- 随机逻辑：优先从用户歌单随机，也可扩展到热门推荐
- 前端：播放模式切换按钮

### 3.3 推荐更多歌单外的歌
- LLM prompt 调整：明确要求推荐用户歌单中不存在的歌曲
- 搜索失败后扩大搜索范围（不同关键词、相似歌手）
- 新增"发现"模式：专门推荐用户没听过但可能喜欢的歌

### 3.4 UI 改进
- 默认播放列表改为中文热门歌曲（或空列表）
- 播放列表搜索状态优化
- 移动端适配优化

---

## 版本规划

| 版本 | 内容 |
|------|------|
| v1.1.0 | Phase 1 后端重构 |
| v1.2.0 | Phase 2 前端重构 |
| v1.3.0 | Phase 3 新功能 |

每版本独立 commit + push + Docker 构建测试。
