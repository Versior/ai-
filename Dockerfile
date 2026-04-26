# ============================================
# Versior AI 电台 - Docker 构建
# 单端口部署：后端 serve 前端静态文件
# ============================================

FROM node:20-alpine AS builder

WORKDIR /app

# 安装后端生产依赖
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# 构建前端
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ============================================
# 生产镜像
# ============================================
FROM node:20-alpine

WORKDIR /app

# 复制后端
COPY backend/src ./backend/src
COPY backend/package*.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# 复制前端构建产物到后端静态目录
COPY --from=builder /app/frontend/dist ./frontend/dist

# 创建数据目录
RUN mkdir -p /app/data /app/logs

# 暴露端口（单端口，后端 serve 前端 + API + WS）
EXPOSE 8834

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --spider -q http://localhost:8834/health || exit 1

# 启动
CMD ["node", "backend/src/server.js"]
