# DNS 泄露检测系统设计

## 概述

为 echo 项目增加 DNS 泄露检测能力。通过自建权威 DNS + Cloudflare Worker + KV 实现完整的 DNS resolver 出口 IP 探测链路。

检测域名：`{token}.d.echo.nocoo.cloud`

## 架构

```
客户端 (snaky / 浏览器)
  │
  ├─ 1. 触发 DNS 解析
  │     fetch(`http://{token}-{n}.d.echo.nocoo.cloud/`)
  │     → 用户的 DNS Resolver 递归查询
  │     → Cloudflare DNS 返回 NS 委派
  │     → VPS 上的 dns-probe 收到查询，提取 resolver IP
  │
  ├─ 2. dns-probe 上报
  │     POST https://echo-collector.worker.hexly.ai/report/{token}
  │     body: { "ip": "<resolver_ip>", "query": "<full_domain>" }
  │     → Worker 写入 KV (key: dns:{token}, value: Set<IP>, TTL: 5min)
  │
  └─ 3. 客户端取结果
        GET https://echo-collector.worker.hexly.ai/result/{token}
        → Worker 从 KV 读取并返回所有记录的 resolver IP
```

## Monorepo 结构

echo 改造为 monorepo，使用 workspace 管理多个 package：

```
echo/
├── packages/
│   ├── ip-service/          # 现有 echo 服务（Bun + Hono，IP 查询）
│   │   ├── src/
│   │   ├── tests/
│   │   ├── data/            # IP 数据库文件
│   │   ├── scripts/         # ipdb 下载脚本
│   │   ├── vercel.json
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── dns-probe/           # VPS Docker DNS 服务（Go）
│   │   ├── main.go
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   └── README.md
│   │
│   └── collector/           # Cloudflare Worker（结果收集 API）
│       ├── src/
│       │   └── index.ts     # 原生 fetch handler
│       ├── wrangler.toml
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                    # 项目级文档（保持现有位置）
├── package.json             # workspace root
└── README.md
```

### 关键约束

- **ip-service 的 Vercel 部署不受影响**：`vercel.json` 移入 `packages/ip-service/`，Vercel 配置 root directory 指向该路径
- **release action 继续正常工作**：GitHub Actions 中调整 working directory 为 `packages/ip-service`

## 组件详细设计

### 1. dns-probe（VPS Docker 服务）

**职责**：监听 UDP 53 端口，作为 `d.echo.nocoo.cloud` 的权威 DNS 服务器。

**技术栈**：Go + `github.com/miekg/dns`

**行为**：

1. 收到 DNS 查询（如 `abc123-3.d.echo.nocoo.cloud`）
2. 从查询来源提取 resolver IP（`w.RemoteAddr()`）
3. 从域名中提取 token（第一个 label，`-` 之前的部分为 token）
4. 异步 POST 到 Worker 上报 resolver IP
5. 返回 A 记录：`10.255.255.1`（RFC 1918 内网地址，不影响外部环境）

**Token 解析规则**：

```
域名格式: {token}-{seq}.d.echo.nocoo.cloud
示例:    xk9f2m7a-3.d.echo.nocoo.cloud
token:   xk9f2m7a
seq:     3（用于多轮检测去重，dns-probe 不关心）
```

**配置**（环境变量）：

| 变量 | 说明 | 示例 |
|------|------|------|
| `WORKER_URL` | collector Worker 地址 | `https://echo-collector.worker.hexly.ai` |
| `RESPONSE_IP` | DNS 响应返回的 A 记录 IP | `10.255.255.1` |

**Docker Compose**：

```yaml
services:
  dns-probe:
    build: .
    restart: unless-stopped
    ports:
      - "53:53/udp"
    environment:
      - WORKER_URL=https://echo-collector.worker.hexly.ai
      - RESPONSE_IP=10.255.255.1
```

### 2. collector（Cloudflare Worker）

**域名**：`echo-collector.worker.hexly.ai`

**KV Namespace**：`echo`

**技术栈**：原生 Worker fetch handler（无框架），TypeScript

**API 接口**：

#### `POST /report/{token}`

DNS probe 上报 resolver IP。

- 请求体：`{ "ip": "114.114.114.114", "query": "xk9f2m7a-3.d.echo.nocoo.cloud" }`
- 行为：
  1. 从 KV 读取 `dns:{token}`（可能不存在）
  2. 将新 IP 追加到数组（去重）
  3. 写回 KV，设置 TTL = 300 秒（5 分钟）
- 响应：`204 No Content`

#### `GET /result/{token}`

客户端获取检测结果。

- 响应：

```json
{
  "token": "xk9f2m7a",
  "dns_servers": ["114.114.114.114", "8.8.8.8"],
  "count": 2,
  "expires_in": 280
}
```

- 如果 token 不存在或已过期：`{ "token": "...", "dns_servers": [], "count": 0 }`

#### `GET /health`

健康检查。

- 响应：`{ "status": "ok", "kv": "connected" }`

**KV 数据结构**：

| Key | Value | TTL |
|-----|-------|-----|
| `dns:{token}` | `["114.114.114.114", "8.8.8.8"]` (JSON array) | 300s |

### 3. Cloudflare DNS 配置

在 `echo.nocoo.cloud` 的 Cloudflare DNS 面板中添加 NS 委派：

```
d    NS    ns1.echo.nocoo.cloud    (不开代理)
ns1  A     <VPS_IP>                (不开代理)
```

如需双 NS（建议）：

```
d    NS    ns1.echo.nocoo.cloud
d    NS    ns2.echo.nocoo.cloud
ns1  A     <VPS1_IP>
ns2  A     <VPS2_IP>
```

### 4. ip-service（现有服务）

保持现有功能不变。Monorepo 改造仅涉及目录迁移：

- `src/` → `packages/ip-service/src/`
- `tests/` → `packages/ip-service/tests/`
- `data/` → `packages/ip-service/data/`
- `scripts/` → `packages/ip-service/scripts/`
- `vercel.json` → `packages/ip-service/vercel.json`
- `Dockerfile` → `packages/ip-service/Dockerfile`

Vercel 项目设置中将 Root Directory 改为 `packages/ip-service`。

## 安全考量

| 风险 | 缓解措施 |
|------|---------|
| 外部随意写入 KV | token 本身是随机字符串，等同密码；5 分钟 TTL 自动清理 |
| DNS probe 被滥用解析任意域名 | dns-probe 仅响应 `*.d.echo.nocoo.cloud`，其他域名返回 REFUSED |
| DDoS 打 DNS probe 53 端口 | VPS 层面做 rate limit（iptables），Worker 侧 KV 写入有 CF 自身的速率保护 |
| 返回的内网 IP 被恶意利用 | `10.255.255.1` 不可路由，浏览器发起的 HTTP 请求会超时，无实际风险 |

## 客户端调用流程（snaky 或浏览器）

```typescript
async function dnsLeakTest(rounds = 5) {
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  // 1. 触发 DNS 解析
  for (let i = 1; i <= rounds; i++) {
    const img = new Image();
    img.src = `http://${token}-${i}.d.echo.nocoo.cloud/pixel.gif`;
    await sleep(600);
  }

  // 2. 等待 DNS probe 上报
  await sleep(2000);

  // 3. 获取结果
  const res = await fetch(`https://echo-collector.worker.hexly.ai/result/${token}`);
  const { dns_servers } = await res.json();

  return dns_servers; // ["114.114.114.114", ...]
}
```

## 部署清单

| 步骤 | 操作 | 负责方 |
|------|------|--------|
| 1 | echo 项目改造为 monorepo | 开发 |
| 2 | Cloudflare DNS 添加 NS 委派记录 | 手动配置 |
| 3 | VPS 部署 dns-probe Docker 容器 | docker compose up -d |
| 4 | 部署 collector Worker + 绑定 KV | wrangler deploy |
| 5 | Vercel 项目设置 Root Directory | 手动配置 |
| 6 | 验证端到端流程 | dig + curl 手动测试 |

## 验证方法

```bash
# 1. 验证 NS 委派
dig NS d.echo.nocoo.cloud
# 应返回 ns1.echo.nocoo.cloud

# 2. 验证 dns-probe 响应
dig @<VPS_IP> test123-1.d.echo.nocoo.cloud
# 应返回 A 10.255.255.1

# 3. 验证 Worker 写入
curl -X POST https://echo-collector.worker.hexly.ai/report/test123 \
  -H "Content-Type: application/json" \
  -d '{"ip":"1.2.3.4","query":"test123-1.d.echo.nocoo.cloud"}'
# 应返回 204

# 4. 验证 Worker 读取
curl https://echo-collector.worker.hexly.ai/result/test123
# 应返回 {"token":"test123","dns_servers":["1.2.3.4"],"count":1,...}
```
