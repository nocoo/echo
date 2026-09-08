<p align="center">
  <img src="assets/brand/icon-rounded.png" alt="Echo logo" width="180" height="180" />
</p>

<h1 align="center">Echo</h1>

<p align="center">查询出口 IP 的位置与运营商，观察 DNS 解析器的出口地址。</p>

<p align="center">
  <a href="https://echo.nocoo.cloud">站点</a> ·
  <a href="docs/README.en.md">English</a>
</p>

## 这是什么

Echo 为网络诊断工具提供 IP 查询 API。它读取本地 IP 数据库，返回国家、省市、运营商及 ASN 信息，供 CLI、监控脚本或其他应用使用。主服务部署在 Vercel，也可以用 Bun 本地运行，没有 Web 控制台。

仓库还包含一套独立的 DNS 探测服务：Go 程序接收指定域名的 DNS 查询，将解析器出口 IP 上报给 Cloudflare Worker，客户端再按随机 token 取回结果。结果反映这次查询经过的解析器，是否符合预期需要调用方判断。

## 功能

- 查询请求方的 IPv4 / IPv6，或使用 API key 查询指定地址。
- 并行读取 ip2region、IPLocate、ip-location-db 和 CIRCL；中国地址优先选 ip2region，其他地址优先选有地理信息的 ip-location-db，并补充其他来源的 ASN。
- 使用 `detail=true` 查看各数据源的结果、错误状态和查询耗时；响应保留数据来源与署名。
- 缓存最近的 IP 查询结果，提供 `/api/live` 服务信息接口。
- 通过 DNS probe 与 Collector 记录解析器出口 IP，按 token 去重，并在最后一次上报后保留五分钟。

地理位置来自下载的数据库，字段可能为空，IPv6 的城市信息也取决于数据源覆盖范围。Collector 的上报与读取接口当前没有鉴权；它返回观察结果，不直接判定 DNS 泄露。

## 使用

### IP 查询

```bash
# 查询本次请求的出口 IP
curl 'https://echo.nocoo.cloud/api/ip'

# 同时查看各数据源的结果
curl 'https://echo.nocoo.cloud/api/ip?detail=true'

# 指定 IP；ECHO_API_KEY 为部署者提供的 key
curl 'https://echo.nocoo.cloud/api/ip?ip=1.1.1.1' \
  -H "X-Api-Key: $ECHO_API_KEY"
```

响应包含 `ip`、`version`（IP 版本）、`location`、`source`、`attribution` 和 `latencyMs`。详细模式额外返回 `providers`。`location` 中包括国家、省市、经纬度、ISP、ASN 与组织名；没有匹配数据时可以为 `null`。

`?ip=` 只有在 `X-Api-Key` 与服务端配置匹配时生效。缺少或错误的 key 会让服务改查请求方 IP，不返回鉴权错误。请求方 IP 从 `X-Forwarded-For` 或 `X-Real-IP` 读取，部署时应由可信代理设置这些头。

### DNS 解析器观察

以下示例需要 `dig`、OpenSSL 和网络连接：

```bash
echo_dns_token=$(openssl rand -hex 12)
dig "${echo_dns_token}-1.d.echo.nocoo.cloud" A +short +time=3 +tries=1
sleep 3
curl "https://echo-collector.worker.hexly.ai/result/${echo_dns_token}"
```

返回字段为 `token`、`dns_servers` 和 `count`。上报与 KV 可见性可能延迟，空列表也可能表示查询未到达或记录已过期；可用同一个 token 稍后再取。DNS probe 目前监听 UDP，并处理该域名下的 A 查询。

macOS 用户也可将 [SwiftBar 脚本](swiftbar/echo.1m.js) 安装到自己的 SwiftBar 插件目录，查看 RTT 和服务端耗时。脚本需要 Node.js 18+。

## 开发

需要 Bun；DNS probe 单独使用 [go.mod](packages/dns-probe/go.mod) 指定的 Go 工具链。以下先在仓库根目录安装 workspace 依赖，再进入 IP 服务包：

```bash
git clone https://github.com/nocoo/echo.git
cd echo
bun install --frozen-lockfile
cd packages/ip-service
bun run ipdb:fetch --verify
bun run dev
```

数据库下载会访问多个外部数据源。默认保存到当前包的 `data/`，不随 Git 分发。服务默认监听端口 `7010`。

| 环境变量 | 用途 |
| --- | --- |
| `IPDB_DIR` | IP 数据目录，默认为当前工作目录下的 `data`；下载与运行时需一致 |
| `ECHO_API_KEY` | 允许通过 `?ip=` 查询指定地址的 key |
| `PORT` | Bun 服务端口，默认 `7010` |

本地直连没有代理注入的 IP 头，可在另一个终端这样请求：

```bash
curl 'http://localhost:7010/api/ip' -H 'X-Forwarded-For: 1.1.1.1'
```

Collector 的开发入口位于独立包，从仓库根目录运行 `bun run --cwd packages/collector dev`。它使用 `ECHO` KV binding。DNS probe 需要 `WORKER_URL`，可选 `PORT` 和 `RESPONSE_IP`；自行部署还需要配置权威 DNS 委派。仓库里的域名、Compose 和 KV 配置对应维护者的环境，迁移时应替换为自己的资源。

```text
packages/ip-service/    Hono API、IP 数据库读取、下载脚本与测试
packages/collector/     Cloudflare Worker 与 KV 结果收集
packages/dns-probe/     Go DNS 服务与 Docker Compose
swiftbar/               macOS 菜单栏脚本
docs/                   设计文档与英文 README
```

IP 服务的 Vercel 配置位于 [packages/ip-service/vercel.json](packages/ip-service/vercel.json)。部署工作流支持版本 tag、每周定时更新和手动运行；普通 `main` 推送只运行 CI。其他组件独立部署，参考 [DNS 设计文档](docs/07-dns-leak-detection.md)。

## 测试

从仓库根目录运行：

| 测试层 | 命令 |
| --- | --- |
| IP 服务单元测试 | `bun run --cwd packages/ip-service test` |
| IP 服务 HTTP 集成测试 | `bun run --cwd packages/ip-service test:e2e` |
| Vercel 构建适配检查 | `bun run --cwd packages/ip-service test:builder` |

HTTP 测试需要 IP 服务 `data/` 下的全部数据库文件，并会启动端口 `7010` 的本地服务。先按开发步骤下载数据，停止占用该端口的开发服务。`bun run --cwd packages/ip-service test:coverage` 可生成覆盖率报告。

Vercel 构建适配检查会在临时目录安装 builder 及依赖，需要网络连接。

Collector 和 DNS probe 目前没有自动化测试套件，也没有浏览器测试。TypeScript 检查分别使用 `bun run --cwd packages/ip-service typecheck` 和 `bun run --cwd packages/collector typecheck`。

## 技术栈

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![Go](https://img.shields.io/badge/Go-00ADD8?logo=go&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

| 部分 | 实现 |
| --- | --- |
| IP API | TypeScript、Bun、Hono；Vercel 托管 |
| IP 数据与缓存 | ip2region.js、MaxMind MMDB reader、lru-cache |
| DNS probe | Go、miekg/dns、Docker |
| 结果收集 | Cloudflare Workers、KV |
| 开发与测试 | Bun workspaces、Vitest、Biome、TypeScript |

依赖以各包的 `package.json`、根目录 [bun.lock](bun.lock) 和 [go.mod](packages/dns-probe/go.mod) 为准。

## 文档

- [文档索引](docs/README.md)
- [DNS 探测设计与部署](docs/07-dns-leak-detection.md)
- [Logo 使用说明](docs/08-logo-usage.md)
- [变更记录](CHANGELOG.md)

早期文档保留了迁移前的目录与方案；当前命令和 API 字段以本 README 为准。DNS 设计中的 `expires_in` 尚未实现。

## 许可证

[MIT](LICENSE) © 2026 Zheng Li。IP 数据库另有各自的数据许可，API 的 `attribution` 字段保留来源署名；使用与再分发数据库时请查阅对应提供者的条款。
