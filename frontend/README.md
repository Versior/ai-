# Versior AI 电台 - 前端

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 7734，自动代理 /api 到后端）
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 配置

API 地址通过 `window.location.hostname` 自动获取，无需手动配置。

如需修改后端端口，编辑 `src/App.jsx` 第 9-10 行：

```javascript
const API_BASE = `${window.location.protocol}//${window.location.hostname}:8834`;
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8834`;
```

## 依赖

| 包 | 用途 |
|----|------|
| react | UI 框架 |
| react-dom | React DOM 渲染 |
| lucide-react | 图标库 |
| tailwindcss | 样式框架 |
| vite | 构建工具 |
| serve | 静态文件服务（生产） |

## 目录结构

```
frontend/
├── src/
│   ├── App.jsx         # 主组件（所有 UI 逻辑）
│   ├── App.css         # 组件样式
│   ├── index.css       # 全局样式（Tailwind + 自定义）
│   └── main.jsx        # 入口文件
├── dist/               # 生产构建产物
├── index.html          # HTML 模板
├── vite.config.js      # Vite 配置
├── tailwind.config.js  # Tailwind 配置
└── postcss.config.js   # PostCSS 配置
```

## 自定义主题

修改 `src/index.css` 中的 CSS 变量：

```css
:root {
  --color-accent: #2ee4a6;    /* 主题色 */
  --color-bg-dark: #111116;   /* 深色背景 */
  --color-bg-light: #f5f5f5;  /* 浅色背景 */
}
```
