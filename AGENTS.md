# Echo

Native-hybrid monorepo: IP API (`packages/ip-service/`, Bun/Hono, MMDB/ip2region), admin console (`packages/dashboard/`, Vite/React/`@nocoo/basalt`), DNS collector (`packages/collector/`, Cloudflare Worker + `ECHO` KV), UDP DNS probe (`packages/dns-probe/`, Go/Docker), and Node 18+ SwiftBar helper (`swiftbar/`).
Docs: [README.md](README.md) · [Docs Index](docs/README.md) · [Testing](docs/05-testing.md) · [DNS Design](docs/07-dns-leak-detection.md) · [Operations](docs/09-operations.md) · [Dashboard](docs/10-dashboard.md) · [Retrospective](Retrospective.md)

## Commands

Run from root unless noted. CI pins Bun 1.4.2 and Node 26.12.1; `packages/dns-probe/` uses the Go version in `packages/dns-probe/go.mod`. Keep secrets in ignored local env files and document variable names only.

```sh
bun install --frozen-lockfile
bun run dev                                      # watch dashboard + serve API & console on :7010
bun run --cwd packages/ip-service ipdb:update    # fetch & verify external IP datasets
bun run --cwd packages/ip-service dev            # IP API only
bun run --cwd packages/dashboard dev             # Vite watch build -> packages/dashboard/dist
bun run --cwd packages/collector dev             # local Wrangler Worker + KV
bun run --cwd packages/ip-service typecheck      # S1 (IP service)
bun run --cwd packages/dashboard typecheck       # S1 (dashboard)
bun run --cwd packages/collector typecheck       # S1 (collector; local only)
bun run lint                                     # S2 Biome check-only, 0 warnings
bun run build                                    # B1 dashboard build
bun run --cwd packages/ip-service test:coverage  # L1 >= 95%
bun run --cwd packages/dashboard test:coverage   # L1 >= 95% (src/lib/**, use-*.ts)
bun run --cwd packages/ip-service test:e2e       # L2 isolated HTTP + synthetic XDB/MMDB
bun run --cwd packages/dashboard playwright install chromium
bun run --cwd packages/dashboard test:e2e        # L4 isolated Playwright E2E
```

IP dev needs datasets in `packages/ip-service/data/` or `IPDB_DIR` (fetched from external providers via `ipdb:update` / `ipdb:fetch -- --verify`; refreshes local DBs only). Defaults: `PORT=7010`, `STATE_DIR=./state` (admin SQLite), `DASHBOARD_DIR=packages/dashboard/dist`. Root `bun run dev` serves API and console on `:7010` matching prod (no second dev port).

Authorized releases run `bun run --cwd packages/ip-service release` (patch default; accepts `minor`/`major`/explicit version or `-- --dry-run`), which tags, pushes, creates a GitHub release, and triggers `.github/workflows/deploy.yml`. Verify deployed `/api/live` returns `ok` with small `ageDays`.

## Invariants

- Authoritative IP-service version lives in `packages/ip-service/package.json` (re-exported by `packages/ip-service/src/lib/version.ts`).
- Use JSON import attributes (`with { type: "json" }`) for Node.js compatibility, and avoid trailing-newline contamination in env values.
- Preserve IP database attribution and source-merging semantics; local IP datasets are downloaded assets, never committed.
- `?ip=` requires a non-revoked `X-Api-Key` from the admin console; invalid keys fall back to requester IP. Trust forwarded IP headers only behind the intended proxy.
- Admin keys and refresh runs live in SQLite (`node:sqlite`) at `$STATE_DIR/echo.db`; there is no `ECHO_API_KEY` env var and no import path from one.
- Admin routes require a Google OAuth session; empty `ALLOWED_EMAILS` rejects every login.
- `PUBLIC_ORIGIN` is the single source of truth for OAuth redirects and CSRF checks; every admin mutation requires `Origin` to match `PUBLIC_ORIGIN` exactly.
- IP service serves `DASHBOARD_DIR` (default `packages/dashboard/dist`): `/admin/assets/*` is static, `/admin` and extension-less `/admin/*` fall back to `index.html`, and a missing build returns 404.
- `/` stays the JSON self-description and unknown `/api/*` paths return a JSON 404, never the console HTML shell.
- Console is a separate Vite app (`basename /admin`, `@nocoo/basalt`); keep pages thin and put fetching/derivation in `src/lib` and `src/app/<page>/use-*.ts` for DOM-free unit testing.
- Public uncached `/api/live` runs a local DB lookup and returns version + 200/503 without DB paths or raw diagnostics.
- A DB refresh older than 7 days reports `outdated` with a non-200 status; report staleness only in days (`ageDays`), never as a timestamp.
- IP service runs on jp4 behind shared `proxy-caddy` (GHCR): console baked in, `/state` writable for SQLite, `/data` read-only host IP DBs (never baked; `deploy/systemd/echo-ipdb-refresh.timer`).
- `proxy-caddy` must overwrite `X-Forwarded-For` with `CF-Connecting-IP`; `/api/ip` reports what the proxy forwards, and Caddy otherwise appends the Cloudflare edge IP.
- Collector exposes an uncached public `/api/live` using its own package version; checks Worker liveness only and never probes or writes KV.
- Collector has unauthenticated report/read endpoints, token deduplication, and 300s KV retention; do not imply stronger auth or a DNS-leak verdict.
- DNS probe is a separate UDP-only Go/Docker service on jp2; changing its IP requires updating the `ns1` A record and Uptime Kuma.
- IP-service deploys via `.github/workflows/deploy.yml` (`deploy-docker`, Tailscale WIF); Collector/DNS deploy independently ([Operations](docs/09-operations.md)); releases/deploys need authorization.

## Quality & Local Gates

Follows `system1-quality`; CI slots and pinned `base-ci` revision live in [.github/workflows/quality-slots.yml](.github/workflows/quality-slots.yml) (`quality / Z1: Gate` required on `main` via [.github/workflows/ci.yml](.github/workflows/ci.yml)). Status vocabulary: `enforced`, `planned`, `manual`, `N/A`. No skipped or focused tests; Biome lint runs check-only with 0 errors/warnings.

- **CI slots**: `S1`–`S3`, `G1`–`G2`, `B1`, `L1`, `L2` (IP HTTP), `L4` (dashboard Playwright), and `Z1` are `enforced`; `L3` (covered by `L2`/`L4`) and `P1` (private monorepo) are `N/A`.
- **L1 coverage**: >=95% statements/branches/functions/lines for `ip-service` (`src/**`, excl. `index.ts`/`version.ts`) and `dashboard` (`src/lib/**`, `src/app/**/use-*.ts`).
- **Planned gaps**: `Collector` typecheck/Worker tests, Go (`dns-probe`) tests/static/OSV, `SwiftBar` coverage, and full DNS/client E2E are `planned`.
- **Partial & manual**: OAuth/key lifecycle is unit-tested only; presentational UI lacks unit coverage; signed-in avatar and docs alignment are `manual` ([Testing](docs/05-testing.md)).
- **Deploy smoke**: `.github/workflows/deploy.yml` runs `enforced` container and edge checks on `/api/live`, `/admin`, and `/api/admin/keys` (401).
- **Local hooks**: installed via `bun install` (`.husky/`); never bypass hooks, and missing `gitleaks` or `osv-scanner` fails the gate.
- **Pre-commit**: scans staged diff with `gitleaks` (`G1`) and checks a `git checkout-index` snapshot for `ip-service`/`dashboard` `S1`/`L1` and root `S2` (target <30s).
- **Pre-push**: runs unit, `lint`, IP `L2`, dashboard `L4` (needs matching Chromium), and `G2` OSV on the working tree; validating pushed stdin refs in parallel (<3m) is `planned`.

## Resources & Isolation

| Lane | Endpoint / State | Boundary |
| --- | --- | --- |
| Dev (IP + Dashboard) | `127.0.0.1:7010` (`https://echo.dev.hexly.ai`), `data/`, `./state`, `packages/dashboard/dist` | Single port matching prod; free `:7010` first; preserve daily local data |
| Tests (`L2` / `L4`) | Random local ports, per-run temp `STATE_DIR`/`SPOOL_DIR`/`IPDB_DIR` (synthetic XDB/MMDB) & temp dashboard build | Isolated per run; checks server instance ID and shuts down before cleanup ([Testing](docs/05-testing.md)) |
| Collector dev | Local Wrangler / Miniflare `ECHO` KV | Local only; per-run fixture marker not yet wired (`planned`) |
| Prod | `https://echo.nocoo.cloud` (jp4), `echo-collector.worker.hexly.ai`, jp2 UDP `:53` | Never target in automated fixtures; read-only checks unless deploy is authorized |

- Worker tests must use local Wrangler/Miniflare with per-run persistence, local-binding checks, and `_test_marker` before writes/cleanup; never create remote `-test` resources.
- DNS/client system tests must use an independent local receiver and synthetic tokens rather than jp2 UDP 53.

## Retrospective

Record incident narratives and root causes in [Retrospective.md](Retrospective.md); promote recurring project constraints to `Invariants` above and enforceable safeguards to tests or hooks.
