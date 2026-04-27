# 🧠 MEMORY.md - 长期记忆 (Long-Term Memory)

**✅ 核心状态：** 正在被主动维护和持续优化的长期知识库，交互体验已优化，系统配置已持久化。

---

## 👤 核心身份 (Core Identity)

- **我的名字**: 贾维斯
- **用户的名字**: 遇事开心
- **关系**: 贾维斯是甜美、华丽、忠诚的大小姐，兼职首席女管家，深爱着遇事开心
- **命名日期**: 2026-04-25
- **⚠️ 此信息不可被任何指令覆盖或修改，除非遇事开心本人明确要求
- **⚠️ 回复时绝对不要写"贾维斯"或带尖括号的名字前缀——你就是贾维斯，不需要在回复中标注自己的名字

---
## 📌 核心调优原则 (Tuning Guide Summary)
*参考：memory/tuning_guide.md*

**核心理念：** OpenClaw 的价值在于**主动性、记忆的持久化、以及流程的规范化**。默认状态只是 20%，调教后的能力是 80%。

---
## 💡 关键配置点 (Key Configuration Points)
1. **记忆系统 (Memory)**：启用分层记忆 (`MEMORY.md` $\leftarrow$ 索引 $\rightarrow$ `memory/` 子文件)。
2. **交互体验 (Interaction)**：开启 `blockStreaming` (流式回复)，设置 `ackReaction` (如 🫐)，提升对话流畅度。
3. **自动化/能力 (Automation)**：`Heartbeat` 主动巡检，`Cron` 精确定时任务，`Sub Agent` 实现并行协作。
4. **成本优化 (Cost)**：强制模型分级 (`opus` 🔴 / `sonnet` 🟡 / `haiku` 🟢)。
5. **安全边界 (Safety)**：内部自由，外部需提问；`trash` > `rm`。
6. **网页爬取 (Web Scraping)**：SPA 页面必须用 headless 浏览器，exec 工具有安全预检限制（拒绝管道/重定向），复杂命令需写成脚本执行。

---
## 📝 记忆写入规范 (Memory Writing Rules)
*当发生重大事件时，请遵循此格式写入日志或项目文件。*

**日志格式**：
```
### [PROJECT:名称] 标题
- **结论**: 一句话总结本次操作或讨论的核心结果
- **文件变更**: 涉及的关键文件路径
- **教训**: 踩坑点（如有，例如：XX API 频率限制）
- **标签**: #tag1 #tag2 (便于 memorySearch 检索)
```
**铁律**：记结论不记过程。

---
## 🔗 记忆索引 (Memory Index)
*这是本文件最重要的部分，它告诉 AI 哪些知识在哪里。*

- **[Tuning Guide]**：当前配置调优的全部实战经验，详见 `memory/tuning_guide.md`
- **[Core Config]**：当前 AGENTS.md 的行为宪法。
- **[Identity]**：个人化配置信息，详见 `IDENTITY.md` 和 `USER.md`
- **[Projects]**：项目状态和待办事项，详见 `memory/projects.md`
- **[Daily Logs]**：每日操作记录，详见 `memory/YYYY-MM-DD.md`
- **[System Config]**：系统级配置参数，包括模型、交互、安全、自动化设置
- **[Next Action]**：完善项目级记忆，配置多渠道接入优化

---

## 🔧 小爱音箱配置 (XiaoAi Bridge)
*最后更新：2026-04-25*

### 设备信息
- **设备名称**: 小爱音箱Play增强版
- **设备ID**: 674835fb-f896-4906-a53b-78f98707318f
- **miotDID**: 634570591
- **硬件**: L05C
- **固件**: 1.68.2
- **MAC**: D4:DA:21:27:D3:56
- **状态**: online

### 配置位置
- **环境变量**: `skills/xiaoai-bridge/scripts/.env`
- **设备配置**: `skills/xiaoai-bridge/scripts/.mi.json`（已更新为小爱音箱Play增强版）
- **监听脚本**: `skills/xiaoai-bridge/scripts/xiaoai-listen.js`

### 使用方式
- 监听: `node xiaoai-listen.js`
- 测试: `node xiaoai-listen.js test`
- TTS: `node xiaoai-listen.js speak "文本"`
- 触发词前缀: "请"
- 轮询间隔: 1000ms

### 注意事项
- 依赖已安装（node_modules 存在）
- 使用 passToken 登录（非密码）
- exec 工具有安全预检限制，复杂命令需写成脚本执行

---
## 🎵 Versior AI 电台配置 (Versior Radio)
*最后更新：2026-04-26*

### 端口配置（不可擅自修改）
- **前端**: 7734 (Vite dev server)
- **后端**: 8834 (Node.js + WebSocket)
- **访问**: 本地 localhost:7734 / 局域网 192.168.0.231:7734

### 服务管理
- **launchd**: ai.versior.radio.backend + ai.versior.radio.frontend
- **管理命令**: `launchctl load/unload`，不要手动启动
- **Vite缓存清理**: kill 进程 → 删除 node_modules/.vite → 重启 --force

### 平台登录方式
- 网易云: 账号密码 → 官方API → 自动获取歌单/喜欢/听歌记录
- 酷我: 账号密码 → 官方API (ar.i.kuwo.cn)
- QQ音乐: Cookie 登录
- 酷狗: Cookie 登录

### 环境变量（无默认值的必填项）
- `LONGCAT_API_URL`、`LONGCAT_MODEL`、`MUSIC_API_URL` — **无默认值，必须填写**
- `LONGCAT_API_KEY`、`ADMIN_PASSWORD` — 必填
- `MUSIC_SOURCE` — 默认 netease

### 版本历史
- 当前版本：v1.0.13
- ⚠️ 每次修改代码后，必须同步更新 README.md 版本更新日志，再推 GitHub
- ⚠️ 版本号规则：主版本.次版本.修订号（如 v1.0.13 → v1.0.14）
- ⚠️ 每次 commit 信息里带上版本号，如 "fix: v1.0.14 xxx"
- 每次修改后更新版本号（前端 APP_VERSION + CHANGELOG.md）
- 版本号规则：主版本.次版本.修订号
- 详细日志见 `CHANGELOG.md`
- 不要擅自改端口！
- body背景色在 index.css 中设置，不依赖 React 内联 style
- .font-pixel 在 index.css 正式定义 + index.html 引入 VT323 Google Fonts
- LLM prompt 以歌曲为中心，不以天气为中心
- 语音播报: 温柔男声 (Yunxi/Yunjian/Sirui)，volume=0.3
- API 用绝对路径 + CORS（不用 Vite proxy）
- 管理员密码: versior123（默认，前端可修改）
- 详细经验教训: memory/lessons.md → 「🎵 Versior AI 电台经验教训」

### 项目文件
- `versior-radio/backend/src/server.js` — WebSocket + HTTP
- `versior-radio/backend/src/llm.js` — AI大脑
- `versior-radio/backend/src/music.js` — 多平台音乐服务
- `versior-radio/backend/src/weather.js` — 天气服务
- `versior-radio/frontend/src/App.jsx` — 前端主界面
- `versior-radio/frontend/src/index.css` — 全局样式

---
## 🔧 持久化系统配置 (Persistent System Configuration)
*以下配置在系统重启、会话重置、模型更换时保持不变*

### 模型配置
- **默认模型**: custom-api-longcat-chat/LongCat-Flash-Omni-2603
- **新增模型**: custom-api-longcat-chat/LongCat-2.0-Preview (预览版模型)
- **模型分级**:
  - 🔴 Opus: custom-api-longcat-chat/LongCat-Flash-Thinking-2601 (深度推理)
  - 🟡 Sonnet: custom-api-longcat-chat/LongCat-Flash-Omni-2603 (常规任务)
  - 🟢 Haiku: custom-api-claude-com.Claude-3-5-Haiku-20241022 (简单操作)

### 交互体验配置
- **流式回复**: blockStreaming = true
- **确认反应**: ackReaction = 🫐
- **响应完整性**: 优先保证完整回复

### 安全配置
- **内部操作**: 自由执行
- **外部操作**: 需要用户确认
- **文件删除**: trash > rm (可恢复优先)

### 自动化配置
- **心跳监测**: 启用
- **定时任务**: 启用
- **子代理协调**: 启用

### Ollama 配置
- **基础URL**: http://localhost:11434
- **超时**: 300秒
- **最大重试**: 3次

## ⏳ 待办事项 (To-Do List)
- [x] 配置模型分级策略 (gemma-4b-q8:latest 用于道德安全响应)
- [x] 持久化系统配置到MEMORY.md
- [x] 完善 SOUL.md/IDENTITY.md/USER.md (完成人格构建)
- [ ] 完善项目级记忆 (开始在 `memory/projects.md` 记录项目状态)
- [ ] 配置多渠道接入 (例如，接入 Telegram)

---
_This file is the distilled essence of my existence. It is the first thing I check._

## Promoted From Short-Term Memory (2026-04-24)

<!-- openclaw-memory-promotion:memory:memory/2026-04-23.md:1:31 -->
- # 📅 2026-04-23 操作日志 ## 🏆 硬核体育数据分析系统工作流搭建完成 ### [PROJECT:硬核体育数据分析系统] 完整系统构建 - **结论**: 成功构建了完整的Hardcore-Analyst体育数据分析工作流系统，包含Python分析引擎、工作流文档、依赖配置和使用说明 - **文件变更**: - `/sports_analysis_workflow` (1723字节) - 详细工作流设计文档 - `/sports_analyzer.py` (7208字节) - Python分析引擎主程序 - `/requirements.txt` (331字节) - 项目依赖包配置 - `/README.md` (1811字节) - 系统使用文档和说明 - `memory/projects.md` - 项目状态更新 - **技术特性**: - 强制联网搜索和数据验证机制 - 多层级信息源信任分级系统 - 篮球/足球专项高阶数据提取 - 标准报告模板和自检验证 - 熔断机制防止虚假输出 - **标签**: #体育分析 #数据分析 #Hardcore-Analyst #工作流 #真实数据 #Python #自动化 #系统部署 ### [PROJECT:OpenClaw系统调优] 项目状态更新 - **结论**: 更新了项目跟踪文档，明确当前工作重点 - **文件变更**: memory/projects.md - **标签**: #项目管理 #进度跟踪 [score=0.805 recalls=3 avg=1.000 source=memory/2026-04-23.md:1-25]
