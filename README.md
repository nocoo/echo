# echo 🚀

An API-only IP lookup service for Vercel and Railway. Fast, Bun + TypeScript, strict TDD.

## What it does ✅

- Returns the client IP (IPv4/IPv6)
- Looks up `ip2region.xdb` and returns structured location
- Returns server-side latency (ms)
- API-only, no UI

## SwiftBar plugin 🧭

This repo ships a SwiftBar plugin so you can turn your self-hosted API into a menu bar latency monitor on macOS.

- Plugin: `swiftbar/echo.1m.js` (refresh every 1 minute)
- Menu bar example (color-coded RTT):

```text
🇨🇳 42ms | color=green
```

Dropdown shows:
- IP
- Country
- Location (province | city)
- ISP
- RTT + Server latency

## Project structure 📁

- `src/` services and routes
- `tests/` unit + e2e
- `scripts/` build/deploy scripts
- `docs/` documentation
- `swiftbar/` SwiftBar plugin

## Run locally 🧪

```bash
bun install
bun run ipdb:fetch
bun run dev
```

Optional env vars:

- `IPDB_DIR` (default: data)
- `IPDB_URL_V4`
- `IPDB_URL_V6`

## API 🔌

- `GET /` service info
- `GET /health` health check
- `GET /api/ip` IP + location + latency
  - Errors return `error.code` and `error.message`

Default port: 7012

## Deploy 🚢

### Vercel

- Uses `vercel.json`
- Build: `bun install && bun run ipdb:fetch`

### Railway (Docker)

```bash
docker build -t echo .
docker run -p 7012:7012 echo
```

With SwiftBar + your deployed API, you get a self-hosted latency monitor in macOS menu bar.

## Tests & docs 📌

- Unit test coverage target: 90%+
- Lint: 0 warnings/errors
- E2E must pass
- Code changes must update docs

```bash
bun run test
bun run test:e2e
bun run test:all
```

E2E requires xdb files:

```bash
bun run ipdb:fetch
```

## Atomic commits 🧱

- One logical change per commit
- Commit after tests pass
- Conventional Commits

## Docs tree 📚

- docs/01-overview.md
- docs/02-features.md
- docs/03-architecture.md
- docs/04-development.md
- docs/05-testing.md
- docs/06-docs-rules.md
