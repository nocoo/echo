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

### Vercel（推荐）

通过 GitHub Actions 自动部署：

- 推送 `v*` tag 触发部署
- 每周一自动更新 IP 数据并部署
- 支持手动 workflow_dispatch

需配置 secrets：`VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`。
