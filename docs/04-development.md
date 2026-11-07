# 本地开发与运行

## 依赖

- Bun 1.3+

## 本地开发流程

1. 安装依赖

```bash
bun install
```

2. 下载 IP 数据库（4 个数据源共 7 个文件）

```bash
bun run ipdb:fetch
```

验证数据库可读性：

```bash
bun run ipdb:fetch --verify
```

可选环境变量：

- `IPDB_DIR`：数据目录，默认 `data`

3. 启动开发服务

```bash
bun run dev
```

## 运行说明

- 默认端口：7010
- 根路径：GET /
- 健康检查：GET /api/live
- IP 查询：GET /api/ip
- 详细模式：GET /api/ip?detail=true

## 数据源

服务启动时并行查询 4 个 provider：

| Provider | 数据文件 | 内容 |
|----------|----------|------|
| ip2region | ip2region_v4.xdb, ip2region_v6.xdb | 国家/省/市/ISP（中国最优） |
| iplocate | iplocate-asn.mmdb, iplocate-country.mmdb | ASN + 国家 |
| ip-location-db | ip-location-db-asn.mmdb, ip-location-db-city.mmdb | ASN + 城市/坐标 |
| CIRCL | circl-country-asn.mmdb | 国家 + ASN |

## 部署

生产环境是 jp4 上的 Docker 容器，由 GitHub Actions 在 `main` 的 CI 通过后自动发布：

- `base-ci` 构建并推送 `ghcr.io/nocoo/echo:<commit sha>`
- 经 Tailscale 进入 tailnet 后 SSH 到 jp4，在 `/data/echo` 拉起新镜像
- IP 数据库不打包进镜像，由 `echo-ipdb-refresh.timer` 每周独立刷新

需在 `echo / production` Environment 配置 secrets：`VPS_HOST`、`VPS_USER`、`VPS_PORT`、`VPS_SSH_KEY`、`VPS_KNOWN_HOSTS`、`GHCR_PULL_USER`、`GHCR_PULL_TOKEN`、`TS_OAUTH_CLIENT_ID`、`TS_AUDIENCE`。主机侧步骤见 [deploy/README.md](../deploy/README.md)。
