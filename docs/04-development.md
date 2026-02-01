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

3. 启动开发服务

```bash
bun run dev
```

## 运行说明

- 默认端口：3000
- 健康检查：GET /health
