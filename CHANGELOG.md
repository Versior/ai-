# 📋 Versior AI 电台 - 更新日志

## v1.3.0 (2026-04-28)
- 📋 播放列表只显示 3 首歌
- 💬 播放列表每首歌显示热评
- 🎵 新增歌词滚动（网易云官方歌词 API）
- 🔄 热评/歌词 Tab 切换

## v1.2.4 (2026-04-28)
- 🚫 播放去重：后端维护最近 20 首播放历史，搜索时排除已播放歌曲
- ✍️ AI 总结改为第一人称叙事风格，去掉「推荐」字样，字数限制 40-80 字
- 🎨 IntroModal 亮色主题对比度优化（深色背景遮罩 + 加深文字颜色）
- ✅ 切歌/暂停逻辑检查：预加载切歌路径正常，togglePlay 逻辑正常

## v1.2.3 (2026-04-28)
- 🔧 IntroModal 响应主题切换（亮色/暗色自适应）

## v1.2.2 (2026-04-28)
- 🎨 默认主题改为亮色
- 🔧 修复：IntroModal 恢复像素风格 + 遇事开心信息 + 主页链接
- 📝 搜索接口确认：使用网易云官方 API（music.163.com/api/cloudsearch/pc）

## v1.2.1 (2026-04-28)
- 🔧 修复：点击播放列表/搜索结果不播放（userInteractedRef 未标记）
- 🔧 修复：音频 URL 失效后恢复播放未更新 src
- 🔧 修复：doPlayTrack 加 load() 确保 URL 变化时重新加载
- 🔧 修复：audio preload 从 auto 改为 none 避免缓存失效 URL
- 🔧 移除 togglePlay 中有问题的静音绕过逻辑

## v1.2.0 (2026-04-28)
- 🎵 恢复多平台支持：酷我、QQ音乐、酷狗（独立平台文件）
- 🤖 LLM prompt 优化：推荐列表外歌曲，帮用户发现新音乐
- 📝 歌单示例从 30 首减到 10 首，减少 LLM 选列表内歌的倾向

## v1.1.0 (2026-04-28)
- 🔧 重构：后端 music.js（~1000行）拆分为 netease.js + index.js + routes/
- 🔧 重构：server.js 从 698 行减到 ~350 行，路由模块化
- 🔧 重构：前端提取 IntroModal 组件
- 🧹 清理：移除酷我/QQ音乐/酷狗相关代码（当前只支持网易云）
- 📝 新增 REFACTOR_PLAN.md

## v1.0.54 (2026-04-27)
- 🔧 优化：LLM 配置改为前端可自定义（API URL/Key/模型名称）
- 🔧 优化：.env 改为空模板，用户自行填写
- 🔧 优化：配置页面添加说明文字

## v1.0.53 (2026-04-27)
- 🧹 清理：删除未使用的后端文件（claude.js/context.js/login.js/musicService.js）
- 🧹 清理：删除未使用的依赖（express/http-proxy-middleware/sqlite3）
- 🧹 清理：删除 weapi 加密函数（aesEncrypt/rsaEncrypt/weapiEncrypt）
- 🧹 清理：删除未调用的方法（_buildTrackInfoFromProxy/_buildTrackInfo）
- 🧹 清理：精简 .env 配置，移除无用变量
- 🧹 清理：docker-compose.yml 移除 MUSIC_API_URL 和 netease-api 代理
- 📝 重写 README.md
- 🔧 修复：AI 总结包含推荐理由+歌曲风格
- 🔧 修复：点击列表歌曲直接播放并生成 AI 总结
- 🔧 修复：预加载走 LLM 生成推荐
- 🔧 修复：进入网站自动播放音乐
- 🔧 修复：queue 从 2 首增加到 3-5 首
- 🔧 修复：热评接口从 weapi 改为 api 路径
