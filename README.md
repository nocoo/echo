# echo 🚀

一个只提供 API 的 IP 查询服务，目标部署到 Vercel 与 Railway。速度优先，Bun + TypeScript，严格 TDD。

## 项目主要功能 ✅

- 返回客户端真实 IP（支持 IPv4/IPv6）
- 查询 ip2region 离线库并返回结构化位置
- 返回服务端观测延迟（毫秒）
- 返回数据来源与 attribution
- 仅 API，无前端页面

## 主要目录结构 📁

- `src/`：服务与路由
- `tests/`：单元测试
- `scripts/`：构建/部署阶段脚本
- `docs/`：项目文档

## 如何运行开发服务器 🧪

```bash
bun install
bun run ipdb:fetch
bun run dev
```

可选环境变量：

- `IPDB_DIR`：数据目录，默认 data
- `IPDB_URL_V4`：IPv4 数据下载地址
- `IPDB_URL_V6`：IPv6 数据下载地址

## 测试与文档要求 📌

- 单元测试覆盖率目标：90%+
- lint 0 warning/error
- E2E 测试必须通过
- 改代码必须同步更新相应文档

## 测试命令 🧪

```bash
bun run test
bun run test:e2e
bun run test:all
```

E2E 测试依赖已下载的 xdb 数据：

```bash
bun run ipdb:fetch
```

## API 说明 📡

- `GET /health`：健康检查
- `GET /api/ip`：返回 IP、位置、延迟、来源与 attribution
  - 错误时返回 `error.code` 与 `error.message`

默认端口：7012

## 部署配置 🚢

- `vercel.json`：Vercel 构建与运行配置
- `Dockerfile`：Railway Docker 部署

## 原子化提交要求 🧱

- 每次提交只包含一个逻辑变更
- 测试通过后立即提交
- 提交信息遵循 Conventional Commits

## 文档树 📚

- docs/01-overview.md
- docs/02-features.md
- docs/03-architecture.md
- docs/04-development.md
- docs/05-testing.md
- docs/06-docs-rules.md
