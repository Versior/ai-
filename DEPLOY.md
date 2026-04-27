# Versior AI 电台 - 部署指南

> 镜像地址：`versior/ai:latest`
> 端口：`7734`（前端 + API + WebSocket 单端口）

---

## 前置要求

- 安装 [Docker](https://docs.docker.com/get-docker/) 和 Docker Compose
- 开放 `7734` 端口（或自定义端口）

---

## 一键部署

### 1. 创建项目目录

```bash
mkdir -p /opt/versior-radio/data/logs
cd /opt/versior-radio
```

### 2. 创建 docker-compose.yml

```yaml
services:
  versior-radio:
    image: versior/ai:latest
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
```

### 3. 创建配置文件

创建 `data/.env`（**所有必填项必须填写，无默认值**）：

```env
NODE_ENV=production
PORT=8834
ADMIN_PASSWORD=你的管理员密码

LONGCAT_API_KEY=你的LongCat API Key（必填）
LONGCAT_API_URL=AI API 地址（必填）
LONGCAT_MODEL=AI 模型名称（必填）

MUSIC_API_URL=音乐搜索 API 地址（必填）
MUSIC_SOURCE=netease
```

> ⚠️ `LONGCAT_API_URL`、`LONGCAT_MODEL`、`MUSIC_API_URL` 三项**没有默认值**，必须手动填写，否则服务无法正常工作。

### 4. 启动

```bash
docker compose pull
docker compose up -d
```

### 5. 验证

```bash
docker compose logs -f
curl http://localhost:7734/health
```

访问 `http://服务器IP:7734` 即可使用。

---

## 常用命令

| 操作 | 命令 |
|------|------|
| 启动 | `docker compose up -d` |
| 停止 | `docker compose down` |
| 重启 | `docker compose restart` |
| 查看日志 | `docker compose logs -f` |
| 更新镜像 | `docker compose pull && docker compose up -d` |
| 进入容器 | `docker exec -it versior-radio sh` |

---

## 多架构镜像构建

镜像支持 `linux/amd64` 和 `linux/arm64`（树莓派 / Apple Silicon 等）。

### 构建并推送多架构镜像

```bash
# 登录 Docker Hub
docker login

# 创建 buildx 构建器（首次）
docker buildx create --use --name multiarch 2>/dev/null || true

# 构建 + 推送 amd64 + arm64
docker buildx build --platform linux/amd64,linux/arm64 \
  -t versior/ai:latest --push .
```

### 仅构建当前架构（本地测试）

```bash
docker build -t versior/ai:latest .
```

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
ss -tlnp | grep 7734

# 健康检查失败
docker exec versior-radio wget -q -O- http://localhost:8834/health

# 重建容器
docker compose down && docker compose build --no-cache && docker compose up -d
```
