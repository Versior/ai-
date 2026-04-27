# ============================================
# Versior AI 电台 - Docker 多架构构建
# 支持 amd64 / arm64
# ============================================
#
# 用法:
#   本地构建当前架构:
#     docker build -t versior/ai:latest .
#
#   构建并推送多架构镜像 (需先 docker login):
#     docker buildx create --use --name multiarch 2>/dev/null || true
#     docker buildx build --platform linux/amd64,linux/arm64 \
#       -t versior/ai:latest --push .
#
#   仅构建不推送 (导出到本地):
#     docker buildx build --platform linux/amd64,linux/arm64 \
#       -t versior/ai:latest --load .
#
# 注意: 如果 Docker Hub 网络不通，可替换基础镜像为:
#   docker.1ms.run/library/node:20-alpine
# ============================================

FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

# 安装编译原生依赖所需的工具（sqlite3 需要 Python + make + g++）
RUN apk add --no-cache python3 make g++

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

# 安装运行时原生依赖所需的工具
RUN apk add --no-cache python3 make g++

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
