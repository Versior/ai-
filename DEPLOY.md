# Versior AI 电台 - 部署指南

> 镜像地址：`versior/versior:latest`
> 端口：`8834`（前端 + API + WebSocket 单端口）

---

## 前置要求

- 安装 [Docker](https://docs.docker.com/get-docker/) 和 Docker Compose
- 开放 `8834` 端口（或自定义端口）

---

## 一键部署（推荐）

### 1. 拉取镜像

```bash
docker pull versior/versior:latest
```

### 2. 创建项目目录

```bash
mkdir -p /opt/versior-radio/data
cd /opt/versior-radio
```

### 3. 创建配置文件

创建 `data/.env`：

```env
NODE_ENV=production
PORT=8834
ADMIN_PASSWORD=你的管理员密码

LONGCAT_API_KEY=你的LongCat API Key
LONGCAT_API_URL=https://api.longcat.chat/openai/v1/chat/completions
LONGCAT_MODEL=LongCat-Flash-Lite

MUSIC_API_URL=http://iwenwiki.com:3000
MUSIC_SOURCE=netease
```

### 4. 启动

```bash
docker compose up -d
```

### 5. 验证

```bash
# 查看日志
docker compose logs -f

# 健康检查
curl http://localhost:8834/health
```

访问 `http://服务器IP:8834` 即可使用。

---

## 纯 Docker 命令（不用 compose）

```bash
docker run -d \
  --name versior-radio \
  -p 8834:8834 \
  -e NODE_ENV=production \
  -e PORT=8834 \
  -e ADMIN_PASSWORD=你的管理员密码 \
  -e LONGCAT_API_KEY=你的API Key \
  -e LONGCAT_API_URL=https://api.longcat.chat/openai/v1/chat/completions \
  -e LONGCAT_MODEL=LongCat-Flash-Lite \
  -e MUSIC_API_URL=http://iwenwiki.com:3000 \
  -e MUSIC_SOURCE=netease \
  -v $(pwd)/data/.env:/app/backend/.env \
  -v $(pwd)/data/user-music-prefs.json:/app/backend/src/user-music-prefs.json \
  --restart unless-stopped \
  versior/versior:latest
```

---

## nginx 反向代理（公网部署）

```nginx
server {
    listen 80;
    server_name radio.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8834;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

---

## 常用命令

| 操作 | 命令 |
|------|------|
| 启动 | `docker compose up -d` |
| 停止 | `docker compose down` |
| 重启 | `docker compose restart` |
| 查看日志 | `docker compose logs -f` |
| 更新镜像 | `docker pull versior/versior:latest && docker compose up -d` |
| 进入容器 | `docker exec -it versior-radio sh` |

---

## 数据持久化

容器重启后以下数据不会丢失：

- `data/.env` — 环境变量配置
- `data/user-music-prefs.json` — 用户音乐偏好（登录后自动获取）
- `data/logs` — 运行日志

---

## 故障排查

```bash
# 容器没起来
docker compose logs

# 端口被占用
lsof -i :8834

# 健康检查失败
docker exec versior-radio wget -q -O- http://localhost:8834/health

# 重建容器
docker compose down && docker compose build --no-cache && docker compose up -d
```
