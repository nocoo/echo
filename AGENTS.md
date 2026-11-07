# Echo

IP lookup API plus a separate DNS resolver-observation service.
Profile: native-hybrid (TypeScript services and Go DNS probe).
Direction: [README.md](README.md), [DNS design](docs/07-dns-leak-detection.md).

## Scope and instruction sources

- This file is the only project handbook; nested files do not compete with it. Do not create a `CLAUDE.md` alias or copy.
- This file is the contract; hooks, CI and config enforce it. Gaps require stronger enforcement, never a lower contract. Frameworks must not rewrite this handbook.
- Human docs: [README.md](README.md) and [docs/README.md](docs/README.md). Version: `packages/ip-service/package.json`; generated `src/lib/version.ts` within that package. Enforcement: `.husky/`, `.github/workflows/ci.yml`, IP-service Vitest configs. Accidents: [Retrospective.md](Retrospective.md). Private configuration: ignored environment files; use variable names only in docs.

## Project invariants

- Preserve database attribution and source-merging semantics; local IP datasets are downloaded assets, never committed.
- `?ip=` requires an `X-Api-Key` that the admin console issued and has not revoked; an invalid key falls back to requester IP. Trust forwarded IP headers only behind the intended proxy.
- Admin keys and refresh runs live in SQLite (`node:sqlite`) at `$STATE_DIR/echo.db`; there is no `ECHO_API_KEY` environment variable and no import path from one.
- Admin routes require a Google OAuth session (`PUBLIC_ORIGIN` is the single source of truth for the OAuth redirect and the CSRF origin check); every mutation requires `Origin` to equal `PUBLIC_ORIGIN` exactly, and `ALLOWED_EMAILS` empty rejects every login.
- The IP service serves the console build from `DASHBOARD_DIR` (default `packages/dashboard/dist`): `/admin/assets/*` is static, `/admin` and extension-less `/admin/*` fall back to `index.html`, and a missing build answers 404. `/` stays the JSON self description and unknown `/api/*` paths answer a JSON 404, never the shell.
- The console is a separate Vite app with `basename /admin`; its pages stay thin and the fetching and derivation live in `src/lib` and `src/app/<page>/use-*.ts` so they are testable without a DOM.
- Public, uncached `/api/live` performs a local database lookup and returns version plus 200/503 without database paths or raw diagnostics. A database refresh older than seven days reports `outdated` and a non-200 status; describe staleness only in days, never as a timestamp.
- The IP service runs as a GHCR image on jp4 behind the shared proxy-caddy. IP databases are mounted from the host, refreshed by `deploy/systemd/echo-ipdb-refresh.timer`, and never baked into the image. The image does bake the console build; the admin SQLite database lives on a writable `/state` volume while `/data` stays read-only. The proxy must overwrite `X-Forwarded-For` with `CF-Connecting-IP`.
- Collector also exposes an uncached public `/api/live`, using its own package version; this is Worker liveness only and does not probe or write KV.
- Collector currently has unauthenticated report/read endpoints, token deduplication and 300-second KV retention. Do not imply stronger authentication or a DNS-leak verdict.
- DNS probe is a separate Go/Docker service on jp2; changing its IP requires updating NS address and Uptime Kuma. Preserve its UDP-only behavior.
- IP-service deployment belongs to `.github/workflows/deploy.yml` (base-ci `deploy-docker`, Tailscale WIF). DNS probe and Collector deploy independently.

## Setup and commands

IP API: Bun, Hono, TypeScript, local MMDB/ip2region files, GHCR image on jp4. Collector: Cloudflare Worker with `ECHO` KV binding. DNS probe: Go toolchain from `packages/dns-probe/go.mod`, Docker. Quality: Bun workspaces, Biome, Vitest; Go testing gap below. `packages/ip-service/` owns the API, downloader and tests; `packages/collector/` owns KV collection; `packages/dns-probe/` owns DNS; `swiftbar/` contains the Node 18+ helper.

Run from root unless a working directory is shown. CI pins Bun 1.4.2; use the Go version in go.mod.

```sh
bun install --frozen-lockfile
bun run --cwd packages/ip-service dev
bun run --cwd packages/collector dev
bun run --cwd packages/dashboard dev
bun run --cwd packages/ip-service typecheck
bun run --cwd packages/collector typecheck
bun run --cwd packages/dashboard typecheck
bun run lint
bun run --cwd packages/ip-service test:coverage
bun run --cwd packages/dashboard test:coverage
bun run --cwd packages/ip-service test:e2e
```

IP dev needs all databases under the package's `data/` or matching `IPDB_DIR`; obtain them with `bun run --cwd packages/ip-service ipdb:fetch --verify`. Downloads access external providers. `PORT` defaults to 7010; `STATE_DIR` holds the admin SQLite database and defaults to `./state`; `DASHBOARD_DIR` holds the console build and defaults to `packages/dashboard/dist`. The root `bun run dev` rebuilds the dashboard in watch mode and serves both the API and the console from 7010, matching production; there is no second dev port.

## Testing and quality contract

6DQ keeps its name with unified L1, L2/L3, G2 and D1; the owner merged former G1 into L1 on 2026-09-21. Statuses: `enforced`, `planned`, `manual`, `N/A`. No skipped/focused tests; required unified L1 coverage is statements/branches/functions/lines each ≥95% plus strict types and check-only lint with zero errors/warnings.

| Piece | Requirement and current reality | Status | Evidence |
| --- | --- | --- | --- |
| L1 TypeScript | IP-service and dashboard four metrics ≥95% plus strict types/lint across both packages and helper; Collector and SwiftBar coverage still missing | planned | IP gate enforced in pre-commit/CI and `packages/ip-service/vitest.config.ts`; dashboard gate in `packages/dashboard/vitest.config.ts` covers `src/lib/**` and `src/app/**/use-*.ts` with hook transitions exercised through jsdom render; the presentational components are not tested at all; IP checks and root Biome run as enforced static subchecks, but Collector typecheck is not in CI and gates use the working tree |
| L1 Go | Meaningful DNS coverage plus Go static checks and formatting at the same contract; no suite or gate yet | planned | `packages/dns-probe/`; no Go gate in hooks/CI |
| L2 | Real HTTP across every service endpoint/method; IP tests exist, Collector coverage incomplete | planned | IP `tests/e2e/global-setup.ts`, pre-push/CI; the console HTTP cases cover the public routes, the admin 401 boundary and the static assets, but the OAuth and key lifecycle still run only in unit tests |
| L3 | Real client IP/DNS workflows on controlled local services | planned | No full DNS/client system gate |
| G2 | OSV + gitleaks; missing scanner fails; cover Bun and Go dependencies | planned | Hooks scan Bun lock/staged secrets; Go dependency gate missing |
| D1 | Per-run state/ports and guards, separate from dev | planned | The IP HTTP suite now takes a random port, temporary STATE_DIR, SPOOL_DIR and an IPDB_DIR of symlinks, and identifies its own server by the instance line; the shared 7010 port and the package data directory are still used by the dev server |
| Packaging | Image builds and `/api/live` reports `ok` with fresh data | enforced | `deploy.yml` remote and edge verification |
| Docs | Keep numbered docs and commands aligned | manual | Diff/link review |

Current pre-commit checks the working tree (IP types, IP coverage, dashboard types, dashboard coverage, root lint) and staged secrets; pre-push runs unit, lint, HTTP and OSV. Target: check-only unified L1 on the index snapshot under 30s; pre-push stdin refs with L2/G2 in parallel under 3min. Commit and branch-push hook bypass is forbidden.

## Resources and isolation

| Purpose | Existing resource | Current isolation |
| --- | --- | --- |
| IP dev / HTTP suite | 7010 for dev; the HTTP suite takes a random port | Shared for dev: run only after freeing the port; the suite is isolated per run |
| Dashboard dev | Served by the IP service on 7010 from `packages/dashboard/dist`, rebuilt by `vite build --watch` | Single port, same origin as production; local https comes from `echo.dev.hexly.ai` in the machine Caddy |
| Collector dev | Local Wrangler KV | Separate per-run fixture guard/marker not established |
| DNS production | jp2 UDP 53 | Never use production as an automated fixture target |

Worker test design must use local Wrangler/Miniflare, per-run persistence, local-binding checks and `_test_marker` before writes/cleanup; never create remote `-test` resources. DNS/client system tests need an independent local receiver and tokens.

## Operations / release

Authorized releases run `bun run --cwd packages/ip-service release` (patch default; minor/major/explicit version or `-- --dry-run`). The script tags/pushes and creates a GitHub release; the deploy workflow builds and deploys the image. `ipdb:update` refreshes local databases only. Collector and DNS steps are in [operations](docs/09-operations.md). Verify deployed `/api/live` reports `ok` with a small `ageDays`.

## Retrospective

Accident narratives live in [Retrospective.md](Retrospective.md); keep only recurring rules here. Global lessons go to nmem/rules; deterministic rules belong in tests/hooks.

- Use JSON import attributes for Node.js compatibility; avoid newline-contaminated environment values.
- Keep the proxy's `X-Forwarded-For` rewrite in mind: `/api/ip` reports whatever the proxy forwards, and Caddy appends the Cloudflare edge IP unless it is overwritten with `CF-Connecting-IP`.
