# 管理台（Vite + Basalt）

IP 服务的管理界面与随附后端能力。目标是让维护者在一个页面里看清各 IP 数据库的新鲜度、直接发起查询、用常见 IP 工具换算，并管理可供外部客户端使用的 API key。

本文档已吸收一轮设计评审的 12 条意见（路由前缀、SQLite 运行时、挂载边界、同源 CSRF、spool 协议、刷新脚本失败语义、门禁接线、测试隔离、交付步骤、密钥切换时点、逐库新鲜度、Basalt 接线）。

## 状态

截至 2026-11-07，P1 的后端与前端骨架已交付，P2 尚未开始。

| 能力 | 状态 | 位置 |
| --- | --- | --- |
| SQLite 存储（`api_keys`、`refresh_runs`） | 已交付 | `packages/ip-service/src/lib/store.ts` |
| PKCE 登录、会话 JWT、Origin 校验、白名单 | 已交付 | `packages/ip-service/src/admin/` |
| 管理路由（概览、查询、key、只读刷新状态） | 已交付 | `packages/ip-service/src/admin/admin-routes.ts` |
| 逐库清单与逐文件新鲜度 | 已交付 | `packages/ip-service/src/lib/dataInventory.ts` |
| `?ip=` 改用 SQLite key，`ECHO_API_KEY` 删除 | 已交付 | `packages/ip-service/src/server.ts` |
| 静态托管 `/admin`（`DASHBOARD_DIR`） | 已交付 | `packages/ip-service/src/lib/dashboard.ts` |
| 五个页面（登录、概览、查询、工具、key） | 已交付 | `packages/dashboard/src/app/` |
| IP 工具计算 | 已交付 | `packages/dashboard/src/lib/ip-math.ts` |
| 门禁接线（pre-commit、CI） | 已交付 | `.husky/`、`.github/workflows/ci.yml` |
| E2E 隔离（随机端口、临时目录、实例标识） | 已交付 | `packages/ip-service/tests/e2e/` |
| 刷新触发与并发 409 | 未开始（P2） | — |
| 部署加固、镜像内置前端、文档回滚演练 | 未开始（P3） | — |

已知的缺口（如实记录）：

- 覆盖率门只统计 `packages/dashboard/src/lib/**`；视图模型有单测但不在门内，纯展示组件没有测试。
- L2 的 HTTP 用例覆盖公开路由、管理路由的 401 边界与静态资源；OAuth 回调、key 创建与撤销的完整流程只在单元测试里跑过。
- `POST /api/admin/refresh` 尚未实现，页面上的刷新按钮保持禁用并提示 P2。
- 镜像、compose、systemd 尚未接入前端产物与 `state`/`spool` 挂载（属 P3，且本次未改动 `deploy/`）。
- Google OAuth 客户端登记与主机上的运行时变量需要仓库所有者完成。

## 决策记录

| 项 | 决定 | 理由 |
| --- | --- | --- |
| 挂载位置 | 同域 `/admin`，登录页 `/admin/login` | 无需新 DNS、Caddy 块与证书；OAuth 回调与会话 Cookie 落在同一 origin |
| 并发刷新 | 同一时刻只允许一个刷新任务 | 刷新会重启容器；并发会互相覆盖 staging |
| 旧 `ECHO_API_KEY` | 不迁移，直接删除 | 管理台接管 key 生命周期；避免两套权威并存。删除与新 key 能力同批交付 |
| UI 技术栈 | Vite 8 + React 19 + Tailwind v4 + `@nocoo/basalt` 3.2.1 | 与仓库外 13 个项目的既有组合一致 |
| 运行形态 | 单进程：ip-service 同时提供 API 与 SPA 静态资源 | 本地一条命令可跑；少一个容器 |
| SQLite 驱动 | `node:sqlite`（`DatabaseSync`） | 同一份代码在 Node/Vitest 与 Bun 运行时都可用，测试可用真实临时库 |

## 架构

```
                        ┌─ /api/ip, /api/live        公开，契约不变
Cloudflare → Caddy → echo-app:7010 ─┼─ /api/auth/*, /api/me      登录流程
                        ├─ /api/admin/*             需 Google 会话
                        ├─ /admin, /admin/*          Vite SPA（静态）
                        └─ /                        JSON 自述，不变
```

挂载与职责边界：

| 宿主路径 | 容器路径 | 模式 | 用途 |
| --- | --- | --- | --- |
| `/data/echo/data` | `/data` | `ro` | IP 数据库，保持不可变 |
| `/data/echo/state` | `/state` | `rw` | `echo.db` 及其 WAL |
| `/data/echo/spool` | `/spool` | `rw` | 刷新请求与状态文件 |

IP 数据库目录保持只读：容器无法删除或改写 MMDB/xdb。这是评审指出的硬边界，SQLite 因此不与数据文件同目录，而是同主机目录树下的 `state/`。

## 目录

```
packages/
  ip-service/
    src/server.ts              公开路由 + 挂载管理路由与静态资源
    src/admin/                 会话、key 存储、概览、刷新协调
    src/lib/dataInventory.ts   静态清单 + 逐文件年龄（不导入下载脚本）
  dashboard/                   新增包 `@echo/dashboard`
    src/app/                   login / overview / lookup / tools / keys
    src/lib/ip-math.ts         掩码与网段计算（纯函数）
    src/lib/api.ts             类型化 API 客户端
    src/styles.css             Basalt Tailwind 接线
```

## 路由与静态资源

- Vite `base: "/admin/"`，react-router `basename: "/admin"`。
- 静态资源从 `/admin/assets/*` 提供；SPA fallback 仅匹配 `/admin` 与 `/admin/*` 中不含扩展名的路径。
- `/` 仍返回 JSON 自述；未知 `/api/*` 仍返回 404 JSON，不被 fallback 吞掉。
- 登录页是 `/admin/login`，与 SPA 同一 basename，避免第二个静态入口。
- OAuth 成功与失败都跳回 `/admin/...`。

## 页面

全部使用 Basalt 3.2.1 既有控件，不自造基础控件。

| 路由 | 内容 | 主要控件 |
| --- | --- | --- |
| `/admin/login` | Google 登录入口，无应用外壳 | `LayerCard` `Button` |
| `/admin` | 数据新鲜度总览、逐库表格、刷新入口 | `StatStrip` `DataTable` `Badge` `Button` |
| `/admin/lookup` | 输入 IP 查询，汇总 + 四路 provider 明细 | `Field` `Input` `LayerCard` `DataTable` |
| `/admin/tools` | 掩码计算、网段换算、IPv6 展开 | `Tabs` `Input` `Select` `DataTable` |
| `/admin/keys` | API key 列表、创建、撤销 | `DataTable` `Dialog` `ConfirmDialog` `Toast` |

外壳固定为 `AppShell` + `AppSkipLink` + `Sidebar` + `AppMain` → `AppHeader` + `ContentIsland` → `PageHeader`。`ThemeToggle` 放 `AppHeader` 右上。

Provider 接线（参照 wooly）：`ThemeProvider` + `LinkProvider` + `TooltipProvider` + 全局 `Toaster`。折叠导航依赖 `TooltipProvider`，缺它会报错。`src/styles.css` 按本仓库实际安装路径写 `@source`，顺序为 `@import "@nocoo/basalt/styles/tailwind"` 再 `@import "tailwindcss"`。

### 概览页数据

每个数据库一行，**逐行用该文件自己的 mtime 计算天数**：

| 列 | 来源 |
| --- | --- |
| 文件名 | 静态清单 |
| 上游来源 | 静态清单里的 provider 名 |
| 大小 | `stat.size` |
| 数据构建日期 | MMDB `metadata.buildEpoch`；xdb 无此字段，显示 `—` |
| 文件修改时间 | `stat.mtime` |
| 陈旧天数 | `Date.now() - 该文件 mtime` |
| 状态 | 缺失 / 正常 / 陈旧 |

聚合值沿用现有语义（最新文件的年龄），不改变 `/api/live` 的公开契约。清单是独立模块，不从 `ipdb-fetch.ts` 导入（该脚本导入即执行下载）。

### IP 工具

纯前端计算，无新依赖：

- CIDR ↔ 点分掩码互转
- 给定 IP 列出 `/8`–`/32` 各前缀下的网络地址、广播地址、可用主机数
- 网段包含判断
- 二进制与十六进制视图
- IPv6 压缩与展开

## 后端 API

公开路由保持现有契约不变。

### 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/auth/google` | PKCE + state，302 到 Google |
| GET | `/api/auth/callback` | 换 token、取 userinfo、校验白名单、下发会话 |
| POST | `/api/auth/logout` | 清除会话（需 CSRF 校验） |
| GET | `/api/me` | 当前用户或 `null` |

### 管理（均需会话）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/overview` | 数据源明细与聚合 |
| POST | `/api/admin/lookup` | `{ ip }`，返回与 `/api/ip?detail=true` 同构的结果 |
| GET | `/api/admin/keys` | 列表，只含前缀 |
| POST | `/api/admin/keys` | `{ name }`，返回一次明文 |
| POST | `/api/admin/keys/:id/revoke` | 撤销 |
| GET | `/api/admin/refresh` | 当前/最近一次刷新状态 |
| POST | `/api/admin/refresh` | 请求刷新，冲突时 409 |

`/api/ip?ip=` 的 `X-Api-Key` 改为查 SQLite。管理台会话用户走 `/api/admin/lookup`，不占用 API key。

## 数据模型

`node:sqlite` 的 `DatabaseSync`，无 ORM。

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active','revoked')),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);

CREATE TABLE refresh_runs (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','running','ok','error')),
  finished_at INTEGER,
  detail TEXT
);
```

只存 `sha256(key)`；列表与日志只出现前缀；明文仅出现在创建响应里一次。

**不记录被查询的 IP**：统计需求是数据新鲜度，不是访问审计。

启动时不做任何从 `ECHO_API_KEY` 的导入。表为空即没有可用 key。

## 认证与授权

- 授权码 + PKCE，`state` 与 `code_verifier` 放短期 Cookie（`HttpOnly`、`Path=/api/auth`、10 分钟）。
- `GET /api/auth/callback` **不校验 Origin**（浏览器顶导不带可控 Origin）；它的 CSRF 防护来自 `state`：必须与 Cookie 中的值逐字节相等，校验后立即删除 `state` 与 `code_verifier` Cookie，一次性使用。缺失或不匹配返回 400，且不交换 token。
- 会话为签名 JWT（`jose`），`HttpOnly`、`SameSite=Lax`、`Path=/`、7 天；仅当 `PUBLIC_ORIGIN` 是 https 时加 `Secure`。
- `PUBLIC_ORIGIN` 是唯一权威来源：OAuth `redirect_uri` 与 CSRF 校验都由它推导，不依赖请求 URL（容器内是 http，代理前是 https）。
- `ALLOWED_EMAILS` 白名单，空值拒绝所有登录（fail closed）。
- 所有状态变更接口（含 logout）校验 `Origin` 必须**精确等于** `PUBLIC_ORIGIN`；缺失、`null`、不匹配一律 403。
- 认证相关响应加 `Cache-Control: no-store`。

新增运行时变量：`PUBLIC_ORIGIN`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`SESSION_SECRET`、`ALLOWED_EMAILS`。

## 刷新触发

容器不挂 docker socket。spool 文件 + systemd path unit，timer / path / 手动执行共用主机锁：

```
POST /api/admin/refresh
  → 若存在未结束 run 或 /spool/refresh.lock 被持有：409
  → 生成 runId，原子写 /spool/refresh.request（文件先写，SQLite 后写；文件是权威）
  → 主机 echo-ipdb-refresh.path 以 PathExists 侦测到请求文件 → 启动 service
  → service 直接调用脚本，**锁只在脚本里**（避免两层 flock 互等）
  → 脚本先消费并删除 request，再写 running 状态
  → 现有脚本下载、verify、逐文件替换、重启容器
  → 结束时原子写 /spool/refresh.status.json（含 runId）
  → GET /api/admin/refresh 以状态文件为准，回填 SQLite
```

`PathExists=` 而不是 `PathChanged=`：单元未运行期间写下的请求、以及开机遗留的请求都会触发，不依赖 `PathChanged` 必须看到一次"变化"。

写入顺序固定为 **先 request 文件、后 SQLite**。若 SQLite 写失败，文件仍会驱动主机执行，读接口从状态文件自行补全记录；反之若先写 SQLite 再写文件失败，会留下一个永远不执行的 `requested` 记录。

失败语义：

| 情况 | 行为 |
| --- | --- |
| 下载或校验失败 | 写 `error` 状态，`data/` 不动，容器不重启 |
| 执行中被中断 | `trap` 写 `error`；下次启动前清理遗留 `request` |
| 状态文件 runId 与请求不匹配 | 视为旧结果，不覆盖新请求 |
| 请求存在但状态文件超 1 小时未更新 | 读接口报 `error`（stale） |
| 已有 run 未结束 | 新的 POST 返回 409 |

脚本自身也要硬化：首个可能失败的命令前建立状态、重启后做有界重试（6 次 ×5s）、xdb 增加结构校验、逐文件替换在文档中如实描述为「非整批事务」。

## 部署变更

| 文件 | 变化 |
| --- | --- |
| 根 `package.json` | 新增 `dev`、`build` 编排（`bun run --filter '*'`） |
| `packages/dashboard/` | 新增 workspace 包与 manifest |
| `packages/ip-service/Dockerfile` | 增加 dashboard 构建阶段，`dist` 拷入镜像 |
| `deploy/compose.yaml` | `data` 保持 `:ro`；新增 `state`、`spool` 挂载；`user: "${ECHO_UID:-1000}:${ECHO_GID:-1000}"` |
| `deploy/ipdb-refresh.sh` | 状态文件、`trap`、`flock`、有界重试 |
| `deploy/systemd/` | 新增 `echo-ipdb-refresh.path`；service 加锁与状态 |
| `deploy/README.md` | spool 协议、目录所有权、排障 |
| `.github/workflows/ci.yml` | 增加 dashboard typecheck、lint、test 与覆盖率 |
| `.husky/pre-commit` | 同上 |

`ECHO_API_KEY` 从 compose、代码与文档中移除；`?ip=` 改用 SQLite key。

主机新增准备（一次性）。compose 的 `user` 与目录所有者必须一致，默认取 1000（jp4 上 `nocoo` 的 uid）；用 `ECHO_UID` / `ECHO_GID` 覆盖：

```bash
mkdir -p /data/echo/{state,spool}
chown -R "${ECHO_UID:-1000}:${ECHO_GID:-1000}" /data/echo/state /data/echo/spool
chmod 700 /data/echo/state /data/echo/spool
id -u nocoo   # 必须等于上面的 ECHO_UID，否则刷新脚本写不了 spool
```

刷新脚本在启动时做一次预检：`test -w "$SPOOL_DIR"` 与应用用户一致，不一致直接写 `error` 状态并退出，而不是静默失败。

## 分期

| 期 | 交付 | 验收 |
| --- | --- | --- |
| **P1** | dashboard 骨架、登录、概览、查询、IP 工具、SQLite、API key 管理、`ECHO_API_KEY` 删除、**dashboard 的 CI 与 pre-commit 门禁** | 本地 `bun run dev` 可用；登录后 `/admin` 五个页面可用；新建 key 可查 `?ip=`；撤销后回落访客 IP；公开 API 契约不变；dashboard typecheck/lint/test/coverage 已接入钩子与 CI |
| **P2** | 刷新触发与状态 | 页面请求 → 主机执行 → `ageDays` 归零；失败可见；并发返回 409 |
| **P3** | 部署加固、文档、回滚演练 | CI 全绿；`/api/live` 仍 `ok`；回滚演练通过 |

P1 包含 key 管理是刻意的：删除环境变量与提供替代能力必须在同一次发布内完成，不能留功能空窗。P1 也包含门禁接线，否则新增代码会在无门禁状态下累积。

### P1 前置步骤（缺一不可）

1. 根 `package.json` 增加 `dev`（`bun run --filter '*' dev`）与 `build`（dashboard build），dashboard 的 `dev` 是 `vite --port 7011`，`vite.config.ts` 里 `server.proxy` 把 `/api` 转发到 `http://127.0.0.1:7010`，保证开发时同源。
2. ip-service 在 `DASHBOARD_DIR` 存在时挂载静态资源；本地未构建时该路径不存在，`/admin` 返回 404 而不是崩溃。
3. Google OAuth 客户端需要登记两个回调：`https://echo.nocoo.cloud/api/auth/callback` 和 `http://localhost:7010/api/auth/callback`。生成或修改客户端由仓库所有者完成。
4. `.env.runtime` 增加 `PUBLIC_ORIGIN`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`SESSION_SECRET`、`ALLOWED_EMAILS`；本地放在 `packages/ip-service/.env.local`（已被 gitignore）。
5. 上线 smoke 覆盖：`/admin` 返回 HTML、`/admin/assets/*` 返回 JS/CSS、深链 `/admin/tools` 返回 HTML、未登录 `/api/admin/*` 返回 401、`/` 与 `/api/ip` 契约不变。

## 测试与质量

- 归属：`ip-math`、API 客户端、token store、会话/授权中间件、`dataInventory` 进 95% 四项覆盖率门。
- dashboard 的纯展示组件不进覆盖率门，逻辑下沉到 `src/lib` 与 hooks（MVVM）；该缺口在 `AGENTS.md` 的 L1 行如实标注。
- Vitest 项目分两个：ip-service（现有）与 dashboard（新增），两者都进 pre-commit 与 CI。
- L2 新增真实 HTTP 用例：未登录 401、非白名单邮箱拒绝、缺失/错误 `Origin` 403、并发刷新 409、撤销后鉴权失效、公开路由不变。
- **测试隔离**：e2e 每次运行使用随机端口、临时 `IPDB_DIR`、临时 `STATE_DIR`、临时 `SPOOL_DIR`，并通过服务启动时打印的实例标识确认对端身份，不再复用 7010 与包内 `data/`。
- 刷新相关测试使用受控的假执行器（临时目录 + stub 脚本），不触碰真实 systemd 与生产 spool。

## 不在本次范围

- 查询日志、访问审计、趋势图表
- 多用户角色与细粒度权限
- API key 的 scope 分级（当前 key 只代表"可查指定 IP"）
- 数据库热替换而不重启容器

## 风险

| 风险 | 处理 |
| --- | --- |
| 单进程同时承载公开与管理路由 | 前缀显式分组 + 统一中间件；公开契约由现有 e2e 守住 |
| 刷新状态文件与 SQLite 双份真相 | 状态文件为准，SQLite 记录发起人与请求时间；runId 匹配后才回填 |
| 代理后 origin 不一致导致登录不可用 | `PUBLIC_ORIGIN` 单一来源，不读请求 URL 推断 |
| 新增前端依赖面 | 固定版本，与既有 13 个项目一致；不使用未发布的本地 Basalt |
| 主机构建需要 dashboard 依赖 | Dockerfile 多阶段构建，运行阶段只带 `dist` |
