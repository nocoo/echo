# 本地开发与运行

## 依赖

- Bun 1.3+

## 本地开发流程

1. 安装依赖

```bash
bun install
```

2. 下载 IP 数据库

```bash
bun run ipdb:fetch
```

可选环境变量：

- IPDB_DIR：数据目录，默认 data
- IPDB_URL_V4：IPv4 数据下载地址
- IPDB_URL_V6：IPv6 数据下载地址

3. 启动开发服务

```bash
bun run dev
```

## 运行说明

- 默认端口：3000
- 健康检查：GET /health
- IP 查询：GET /api/ip
