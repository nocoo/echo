# Echo 部署（jp4 Docker）

IP 服务的生产部署：GHCR 镜像 + 主机 Compose + 共享 Caddy + 主机侧数据刷新。

## 拓扑

```
Cloudflare (echo.nocoo.cloud)
  └─► proxy-caddy  (mTLS, Cloudflare Origin 证书)
        └─► echo-app :7010   ← 镜像只读挂载 /data/echo/data，读写挂载 /data/echo/state
```

- 镜像：`ghcr.io/nocoo/echo:<commit sha>`，由 `.github/workflows/deploy.yml` 调 `base-ci/deploy-docker.yml` 构建并部署。
- 容器不内置 IP 数据库；数据在主机上独立刷新，与代码发布解耦。
- 管理台前端在镜像构建时打包（多阶段构建），运行阶段只带 `dist`，不随主机变化。
- 公网端口由 proxy-caddy 独占，应用只监听 `127.0.0.1:17010`。

## 主机目录

```
/data/echo/
├── compose.yaml          # 本仓 deploy/compose.yaml
├── .env.runtime          # PUBLIC_ORIGIN、SESSION_SECRET、ALLOWED_EMAILS 等运行时变量（chmod 600）
├── ipdb-refresh.sh       # 本仓 deploy/ipdb-refresh.sh（chmod 755）
├── data/                 # IP 数据库，容器只读挂载
├── state/                # 管理台 SQLite（echo.db 与其 WAL），容器读写挂载
├── staging/              # 刷新时的临时下载目录
└── .base-ci-releases/    # base-ci 写入的发布记录
```

## 首次准备

```bash
sudo mkdir -p /data/echo/{data,state,staging} /data/echo/.base-ci-releases
sudo chown -R nocoo:nocoo /data/echo
chmod 755 /data/echo /data/echo/data
chmod 700 /data/echo/state

cp compose.yaml ipdb-refresh.sh /data/echo/
chmod 600 /data/echo/.env.runtime   # 见下方变量表
chmod 755 /data/echo/ipdb-refresh.sh

docker network create edge          # 若尚未存在
```

`.env.runtime` 必填（compose 以 `required: true` 读取）：

| 变量 | 用途 |
| --- | --- |
| `PUBLIC_ORIGIN` | `https://echo.nocoo.cloud`；OAuth 回调与 CSRF 校验的唯一来源 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 客户端 |
| `SESSION_SECRET` | 会话 JWT 签名密钥，建议 `openssl rand -base64 48` |
| `ALLOWED_EMAILS` | 允许登录管理台的邮箱，逗号分隔；为空则无人可登录 |

变量缺失不会阻止容器启动，但管理台会拒绝登录或返回 401。`/data/echo/state` 由容器进程写入；镜像未设置 `USER`，因此当前以 root 运行，目录属主不影响写入。

首次填充数据：任选其一。

```bash
# 已有镜像时，直接在主机刷新
/data/echo/ipdb-refresh.sh
```

Caddy 站点块（`/opt/proxy/Caddyfile`）：

```caddyfile
echo.nocoo.cloud {
	import nocoo_tls
	reverse_proxy echo-app:7010
}
```

改完 `cd /opt/proxy && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`。

## 数据刷新

`echo-ipdb-refresh.timer` 每周一 04:30 触发（`Persistent=true`，错过的窗口会在开机后补跑）：

1. 用**当前运行镜像**在 `staging/` 下载 7 个库并 `--verify`（MMDB 必须能 open）
2. 逐个 `mv` 到 `data/`（同一文件系统内原子替换）
3. `docker restart echo-app`，让 xdb 与 MMDB reader 重载

任一步失败都不会改动 `data/`，也不会重启容器。手动执行：

```bash
sudo systemctl start echo-ipdb-refresh.service
journalctl -u echo-ipdb-refresh.service -n 50 --no-pager
```

安装单元：

```bash
sudo cp systemd/echo-ipdb-refresh.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now echo-ipdb-refresh.timer
systemctl list-timers echo-ipdb-refresh.timer
```

## 发布与回滚

发布由 CI 驱动，主机侧不需要 `IMAGE_SHA`：`docker compose restart web` 沿用当前镜像。

回滚时在 `/data/echo/.base-ci-releases/<sha>.json` 找到上一版 digest，把 `compose.yaml` 的 `image` 临时改为 `ghcr.io/nocoo/echo@sha256:<digest>` 后 `docker compose up -d --no-deps web`，再 revert `main` 让 CD 重建正确版本。

## 验证

```bash
# 主机环回（绕开 Cloudflare，不经 mTLS）
curl -s -H 'Host: echo.nocoo.cloud' http://127.0.0.1:17010/api/live

# 公网
curl -s https://echo.nocoo.cloud/api/live
curl -s https://echo.nocoo.cloud/api/ip

# 管理台
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://echo.nocoo.cloud/admin
curl -s -o /dev/null -w '%{http_code}\n' https://echo.nocoo.cloud/api/admin/keys   # 未登录应为 401
```

`/admin` 返回 HTML、`/admin/assets/*` 返回 JS/CSS；`/api/*` 始终是 JSON。镜像内置前端，主机不需要单独构建。

`/api/live` 约定：

| 字段 | 含义 |
| --- | --- |
| `status` | `ok` / `outdated` / `error`；只有 `ok` 返回 HTTP 200，其余 503 |
| `database.connected` | 本地数据库能完成一次查询 |
| `database.ageDays` | 最新数据库文件的陈旧天数；无法读取时为 `null` |

`ageDays` 超过 7 天时 `status` 变为 `outdated`。`version` 必须与 `packages/ip-service/package.json` 一致。

`/api/ip` 返回的 `ip` 应为真实访客地址；`Caddyfile` 里 `header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}` 负责把它从 Cloudflare 边缘 IP 纠正过来。
