# 📋 Versior AI 电台 - 更新日志

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
