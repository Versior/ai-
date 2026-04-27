# 📋 Versior AI 电台 - 更新日志

## v1.0.19 (2026-04-27)
- 🔧 恢复：NeteaseCloudMusicApi 代理容器（最优方案）
- 🔧 修复：搜索优先用代理 API，失败回退歌单随机选
- 🔧 修复：docker-compose 恢复 netease-api 服务

## v1.0.18 (2026-04-27)
- 🔧 修复：完全去掉 NeteaseCloudMusicApi 代理容器依赖
- 🔧 修复：搜索/播放链接/详情/热评全部改用 POST 官方 API（只需 Cookie）
- 🔧 修复：pickRandomFromLibrary 从歌单随机选 10 首尝试

## v1.0.17 (2026-04-27)
- 🔧 修复：getSongUrl 改用 POST 官方 API（不需要加密，只需 Cookie）
- 🔧 修复：搜索多重重试：代理 API → 官方 POST → weapi 加密
- 🔧 修复：前端重新构建打包

## v1.0.16 (2026-04-27)
- 🔧 修复：pickRandomFromLibrary 方法移到 MusicService 类内部（修复语法错误）

## v1.0.15 (2026-04-27)
- 🔧 修复：搜索失败后从用户歌单随机选一首能播放的歌曲
- 🔧 修复：新增 pickRandomFromLibrary + getSongUrl 方法
- 🔧 修复：getSongUrl 优先用代理 API，回退 weapi 加密

## v1.0.14 (2026-04-27)
- 🔧 修复：搜索优先用 NeteaseCloudMusicApi 代理容器，回退 weapi 加密
- 🔧 修复：docker-compose 新增 netease-api 代理容器
- 🔧 修复：前端 WS 天气消息加日志

## v1.0.13 (2026-04-27)
- 🔧 修复：网易云搜索/播放链接/详情/热评全部改为 weapi 加密接口
- 🔧 修复：AES-128-CBC + RSA 加密实现，不再依赖第三方代理

## v1.0.12 (2026-04-27)
- 🔧 修复：天气数据通过 WS 发送给前端（之前只给 LLM 用，没传给前端）
- 🔧 修复：前端 dj_broadcast/dj_response 处理天气数据

## v1.0.11 (2026-04-27)
- 🔧 修复：登录状态显示逻辑（success/error 分开显示，自动刷新不触发错误提示）
- 🔧 修复：切换平台时清空该平台登录状态
- 🔧 修复：refreshMusicStatus 不再把后端 error 存入状态

## v1.0.10 (2026-04-27)
- 🔧 修复：网易云所有接口改为官方移动端 API（不再依赖第三方代理）
- 🔧 修复：QQ 音乐接口改为官方 API
- 🔧 修复：各平台 baseUrl 改为各自官方域名
- ⚠️ 注意：第三方 API iwenwiki.com:3000 已下线，全部替换

## v1.0.9 (2026-04-27)
- 🔧 修复：网易云登录状态显示（前端判断字段从 loggedIn 改为 success）
- 🔧 修复：后端登录接口返回 loggedIn 字段
- 🔧 修复：README 添加版本更新日志

## v1.0.8 (2026-04-27)
- 🔧 修复：WS 断连后自动重连（指数退避，最多 10 次）
- 🔧 修复：切歌在 WS 断开时用 HTTP 兜底（`/api/next` 接口）
- 🔧 修复：后端 API 路由支持 query string 匹配
- 🔧 修复：`serveStatic` 只处理 GET 请求，POST 返回 405
- 🔧 修复：前端 API 端口动态获取，不再硬编码 8834
- 🔧 修复：去掉前端页面中 LongCat 具体模型名称显示
- ✨ 新增：底部显示版本号
- 📦 Docker 镜像改为官方 `node:20-alpine` 基础镜像

## v1.0.7 (2026-04-27)
- 🔧 去掉 `LONGCAT_API_URL`、`LONGCAT_MODEL`、`MUSIC_API_URL` 默认值，改为必填
- ✨ 新增：前端设置页「🔑 密码」Tab，支持修改管理员密码
- ✨ 新增：后端 `/api/change-password` 接口
- 🔧 默认密码改为 `versior123`
- 📦 Dockerfile 支持 buildx 多架构（amd64 + arm64）
- 📦 新增 GitHub Actions 自动构建多架构镜像

## v1.0.6 (2026-04-26)
- 🔧 放弃 Vite dev server，改用生产构建由后端统一服务
- 🔧 修复：登录接口支持所有平台
- 🔧 修复：音乐平台登录状态刷新

## v1.0.5 (2026-04-25)
- 🔧 修复：网易云 Cookie 登录
- 🔧 修复：前端播放列表点击搜索
- 🔧 修复：进度条拖动冲突

## v1.0.0 (2026-04-24)
- 🎉 初始版本发布
- 🤖 AI DJ — AI 驱动，自然语言对话点歌
- 🎨 赛博朋克 UI
- 🎵 多平台支持（网易云、酷我、QQ音乐、酷狗）
- 🌤️ 天气感知推荐
- 📱 响应式设计
