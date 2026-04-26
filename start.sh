#!/bin/sh
# Versior AI 电台启动脚本

echo "🎵 启动 Versior AI 电台..."

# 启动后端（后台）
cd /app/backend
node src/server.js &

# 启动前端静态服务
cd /app/frontend
npx serve -s dist --listen 7734 &

echo "✅ Versior AI 电台已启动"
echo "   前端: http://localhost:7734"
echo "   后端: http://localhost:8834"

# 保持容器运行
wait
