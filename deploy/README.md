# Echo 部署（jp4 Docker）

IP 服务的生产部署：GHCR 镜像 + 主机 Compose + 共享 Caddy + 主机侧数据刷新。

## 拓扑

```
Cloudflare (echo.nocoo.cloud)
  └─► proxy-caddy  (mTLS, Cloudflare Origin 证书)
        └─► echo-app :7010   ← 镜像只读挂载 /data/echo/data
```

- 镜像：`ghcr.io/nocoo/echo:<commit sha>`，由 `.github/workflows/deploy.yml` 调 `base-ci/deploy-docker.yml` 构建并部署。
- 容器不内置 IP 数据库；数据在主机上独立刷新，与代码发布解耦。
- 公网端口由 proxy-caddy 独占，应用只监听 `127.0.0.1:17010`。

## 主机目录

```
/data/echo/
├── compose.yaml          # 本仓 deploy/compose.yaml
├── .env.runtime          # ECHO_API_KEY 等运行时变量（chmod 600）
├── ipdb-refresh.sh       # 本仓 deploy/ipdb-refresh.sh（chmod 755）
├── data/                 # IP 数据库，容器只读挂载
├── staging/              # 刷新时的临时下载目录
└── .base-ci-releases/    # base-ci 写入的发布记录
```

## 首次准备

```bash
sudo mkdir -p /data/echo/{data,staging} /data/echo/.base-ci-releases
sudo chown -R nocoo:nocoo /data/echo
chmod 755 /data/echo /data/echo/data

cp compose.yaml ipdb-refresh.sh /data/echo/
chmod 600 /data/echo/.env.runtime   # printf 'ECHO_API_KEY=%s\n' "<key>" > .env.runtime
chmod 755 /data/echo/ipdb-refresh.sh

docker network create edge          # 若尚未存在
```

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
```

`/api/live` 约定：

| 字段 | 含义 |
| --- | --- |
| `status` | `ok` / `outdated` / `error`；只有 `ok` 返回 HTTP 200，其余 503 |
| `database.connected` | 本地数据库能完成一次查询 |
| `database.ageDays` | 最新数据库文件的陈旧天数；无法读取时为 `null` |

`ageDays` 超过 7 天时 `status` 变为 `outdated`。`version` 必须与 `packages/ip-service/package.json` 一致。

`/api/ip` 返回的 `ip` 应为真实访客地址；`Caddyfile` 里 `header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}` 负责把它从 Cloudflare 边缘 IP 纠正过来。
