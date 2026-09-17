# Echo

IP lookup API plus a separate DNS resolver-observation service.
Profile: native-hybrid (TypeScript services and Go DNS probe).
Direction: [README.md](README.md), [DNS design](docs/07-dns-leak-detection.md).

## Sources of Truth

This file is the contract; hooks, CI and config enforce it. Gaps require stronger enforcement, never a lower contract. Frameworks must not rewrite this handbook.

| Fact | Where |
| --- | --- |
| Human docs | [README.md](README.md), [docs/README.md](docs/README.md) |
| Version | `packages/ip-service/package.json`; generated `src/lib/version.ts` within that package |
| Enforcement | `.husky/`, `.github/workflows/ci.yml`, IP-service Vitest configs |
| Accidents | [Retrospective.md](Retrospective.md) |
| Private configuration | Ignored environment files; use variable names only in docs |

## Project Invariants

- Preserve database attribution and source-merging semantics; local IP datasets are downloaded assets, never committed.
- `?ip=` requires matching `X-Api-Key` / `ECHO_API_KEY`; an invalid key falls back to requester IP. Trust forwarded IP headers only behind the intended proxy.
- Public, uncached `/api/live` performs a local database lookup and returns version plus 200/503 without database paths or raw diagnostics.
- Collector currently has unauthenticated report/read endpoints, token deduplication and 300-second KV retention. Do not imply stronger authentication or a DNS-leak verdict.
- DNS probe is a separate Go/Docker service on jp2; changing its IP requires updating NS address and Uptime Kuma. Preserve its UDP-only behavior.
- Vercel Git auto-deploy stays disabled; the release workflow owns IP-service deployment. DNS probe and Collector deploy independently.

## Stack / Layout

| Component | Choice |
| --- | --- |
| IP API | Bun, Hono, TypeScript, local MMDB/ip2region files; Vercel production |
| Collector | Cloudflare Worker and `ECHO` KV binding |
| DNS probe | Go toolchain from `packages/dns-probe/go.mod`, Docker |
| Quality | Bun workspaces, Biome, Vitest; Go testing gap below |

`packages/ip-service/` owns the API, downloader and tests; `packages/collector/` owns KV collection; `packages/dns-probe/` owns DNS; `swiftbar/` contains the Node 18+ helper.

## Commands

Run from root unless a working directory is shown. CI pins Bun 1.4.2; use the Go version in go.mod.

```sh
bun install --frozen-lockfile
bun run --cwd packages/ip-service dev
bun run --cwd packages/collector dev
bun run --cwd packages/ip-service typecheck
bun run --cwd packages/collector typecheck
bun run lint
bun run --cwd packages/ip-service test:coverage
bun run --cwd packages/ip-service test:e2e
bun run --cwd packages/ip-service test:builder
```

IP dev needs all databases under the package's `data/` or matching `IPDB_DIR`; obtain them with `bun run --cwd packages/ip-service ipdb:fetch --verify`. Downloads access external providers. `PORT` defaults to 7010; `ECHO_API_KEY` controls explicit-address lookup. Builder verification installs its own temporary dependencies. There is no root build script; the Vercel builder check validates packaging.

## Verification

6DQ = L1/L2/L3 + G1/G2 + D1. Status: `enforced`, `planned`, `manual`, `N/A`. No skipped/focused tests; required L1 coverage is statements/branches/functions/lines each ≥95%.

| Piece | Requirement and current reality | Status | Evidence |
| --- | --- | --- | --- |
| L1 TypeScript | IP-service four metrics ≥95%; Collector and SwiftBar coverage still missing | planned | IP gate enforced in pre-commit/CI and `packages/ip-service/vitest.config.ts` |
| L1 Go | Meaningful DNS coverage at the same contract; no suite yet | planned | `packages/dns-probe/` |
| L2 | Real HTTP across every service endpoint/method; IP tests exist, Collector coverage incomplete | planned | IP `tests/e2e/global-setup.ts`, pre-push/CI |
| L3 | Real client IP/DNS workflows on controlled local services | planned | No full DNS/client system gate |
| G1 TypeScript | Strict types and lint, zero errors/warnings across both packages and helper | planned | IP checks/root Biome enforced; Collector typecheck is not in CI |
| G1 Go | Go static checks and formatting, zero findings | planned | No Go gate in hooks/CI |
| G2 | OSV + gitleaks; missing scanner fails; cover Bun and Go dependencies | planned | Hooks scan Bun lock/staged secrets; Go dependency gate missing |
| D1 | Per-run state/ports and guards, separate from dev | planned | IP HTTP tests currently reuse 7010 and package data |
| Packaging | Vercel builder succeeds | enforced | Pre-push and CI `test:builder` |
| Docs | Keep numbered docs and commands aligned | manual | Diff/link review |

Current pre-commit checks the working tree (IP types, lint, coverage) and staged secrets; pre-push runs builder, unit, lint, HTTP and OSV. Target: check-only index snapshot L1/G1 under 30s; pre-push stdin refs with L2/G2 in parallel under 3min. Commit and branch-push hook bypass is forbidden.

## Resources / Isolation

| Purpose | Existing resource | Current isolation |
| --- | --- | --- |
| IP dev / HTTP suite | 7010; package `data/` | Shared: run only after freeing the port; dedicated harness planned |
| Collector dev | Local Wrangler KV | Separate per-run fixture guard/marker not established |
| DNS production | jp2 UDP 53 | Never use production as an automated fixture target |

Worker test design must use local Wrangler/Miniflare, per-run persistence, local-binding checks and `_test_marker` before writes/cleanup; never create remote `-test` resources. DNS/client system tests need an independent local receiver and tokens.

## Operations / Release

Authorized releases run `bun run --cwd packages/ip-service release` (patch default; minor/major/explicit version or `-- --dry-run`). `ipdb:update` also releases. The script tags/pushes and creates a GitHub release; CI deploys Vercel. Collector and DNS steps are in [operations](docs/09-operations.md). Verify deployed `/api/live` and the next `status.hexly.ai` sample.

## Retrospective

Accident narratives live in [Retrospective.md](Retrospective.md); keep only recurring rules here. Global lessons go to nmem/rules; deterministic rules belong in tests/hooks.

- Use JSON import attributes for Node/Vercel compatibility; avoid newline-contaminated environment values.
- Keep Vercel CLI working-directory/root-directory settings unambiguous and use the supported remote build flow.
