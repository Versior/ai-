#!/bin/bash
# ============================================
# Versior AI 电台 - 一键部署脚本
# 使用方法: 复制全部内容到服务器 SSH 执行
# ============================================

set -e

echo "🎵 Versior AI 电台 - 一键部署"
echo "=============================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 未安装 Docker"
    exit 1
fi

# 1. 配置 Docker 镜像加速（如果 daemon.json 不存在）
if [ ! -f /etc/docker/daemon.json ]; then
    echo "📦 配置 Docker 镜像加速..."
    sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.m.daocloud.io"
  ]
}
EOF
    echo "🔄 重启 Docker..."
    sudo systemctl restart docker
    sleep 3
fi

# 2. 自动创建项目目录（当前目录下）
PROJECT_DIR="$(pwd)/versior-radio"
echo "📂 创建项目目录: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR/data/logs"
cd "$PROJECT_DIR"

# 3. 自动创建 docker-compose.yml
echo "📝 创建 docker-compose.yml..."
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'

services:
  versior-radio:
    image: versior/versior:latest
    container_name: versior-radio
    ports:
      - "7734:8834"
    volumes:
      - ./data/.env:/app/backend/.env
      - ./data/user-music-prefs.json:/app/backend/src/user-music-prefs.json
      - ./data/logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=8834
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8834/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
COMPOSE

# 4. 自动创建默认 .env（如果不存在）
if [ ! -f data/.env ]; then
    echo "🔑 创建默认配置文件..."
    cat > data/.env << 'ENV'
NODE_ENV=production
PORT=8834
ADMIN_PASSWORD=versior123

LONGCAT_API_KEY=
LONGCAT_API_URL=https://api.longcat.chat/openai/v1/chat/completions
LONGCAT_MODEL=LongCat-Flash-Lite

MUSIC_API_URL=http://iwenwiki.com:3000
MUSIC_SOURCE=netease
ENV
fi

# 5. 自动创建空的 user-music-prefs.json（如果不存在）
if [ ! -f data/user-music-prefs.json ]; then
    echo "[]" > data/user-music-prefs.json
fi

# 6. 拉取镜像
echo "📥 拉取镜像..."
docker compose pull

# 7. 启动容器
echo "🚀 启动容器..."
docker compose up -d

# 8. 等待就绪
echo "⏳ 等待服务就绪..."
for i in $(seq 1 30); do
    if docker exec versior-radio wget -q -O- http://localhost:8834/health &> /dev/null; then
        break
    fi
    sleep 2
done

# 9. 获取本机 IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ip addr show 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 | head -1 || echo "localhost")

echo ""
echo "✅ 部署完成！"
echo "   访问地址: http://${LOCAL_IP}:7734"
echo "   管理密码: versior123（请尽快修改）"
echo ""
echo "📝 首次使用："
echo "   1. 浏览器访问上面的地址"
echo "   2. 点击右上角设置（齿轮图标）"
echo "   3. 输入管理员密码: versior123"
echo "   4. 填入 API Key 和音乐账号"
echo "   5. 保存即可开始使用"
echo ""
echo "📋 常用命令："
echo "   查看日志: cd $PROJECT_DIR && docker compose logs -f"
echo "   重启服务: cd $PROJECT_DIR && docker compose restart"
echo "   停止服务: cd $PROJECT_DIR && docker compose down"
echo "   更新版本: cd $PROJECT_DIR && docker compose pull && docker compose up -d"
