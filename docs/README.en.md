<p align="center">
  <img src="../assets/brand/icon-rounded.png" alt="Echo logo" width="180" height="180" />
</p>

<h1 align="center">Echo</h1>

<p align="center">Look up an exit IP's location and network, and observe DNS resolver exit addresses.</p>

<p align="center">
  <a href="https://echo.nocoo.cloud">Website</a> ·
  <a href="../README.md">简体中文</a>
</p>

## What it does

Echo provides an IP lookup API for network diagnostic tools. It reads local IP databases and returns country, region, city, network and ASN information for CLIs, monitoring scripts and other applications. The main service runs as a Docker image on a self-hosted VPS, or locally with Bun. It has no web dashboard.

The repository also contains a separate DNS observation service. A Go program receives DNS queries for a delegated domain and reports resolver exit IPs to a Cloudflare Worker. Clients retrieve the observations using a random token. Results describe the path of those queries; the caller decides whether the resolvers are expected.

## Features

- Look up the requesting client's IPv4 / IPv6 address, or use an API key to select an address.
- Query ip2region, IPLocate, ip-location-db and CIRCL in parallel. Prefer ip2region for Chinese addresses and ip-location-db with location data elsewhere, and enrich missing ASN details from other providers.
- Use `detail=true` to inspect each provider's results, error state and query time. Responses retain source names and attribution.
- Cache recent IP lookups. `/api/live` reports service status, database age in days and version, and reports `outdated` once the data has not been refreshed for more than seven days.
- Record resolver exit IPs through the DNS probe and Collector, deduplicate them by token, and retain them for five minutes after the latest report.

Location information comes from downloaded databases. Fields can be empty, and IPv6 city details depend on provider coverage. Collector report and result endpoints currently have no authentication. They return observations without classifying DNS leaks.

## Usage

### IP lookup

```bash
# Look up the exit IP used by this request
curl 'https://echo.nocoo.cloud/api/ip'

# Include individual provider results
curl 'https://echo.nocoo.cloud/api/ip?detail=true'

# Select an IP; the key is issued by the admin console (/admin/keys)
curl 'https://echo.nocoo.cloud/api/ip?ip=1.1.1.1' \
  -H "X-Api-Key: $API_KEY"
```

Responses include `ip`, `version` (the IP version), `location`, `source`, `attribution` and `latencyMs`. Detailed mode adds `providers`. Location fields cover country, region, city, coordinates, ISP, ASN and organization. `location` can be `null` when no data matches.

`?ip=` takes effect only when `X-Api-Key` matches an active key issued by the admin console. A missing or incorrect key makes the service look up the requesting client's IP instead of returning an authentication error. The client IP comes from `X-Forwarded-For` or `X-Real-IP`; a trusted proxy should set those headers in a deployment.

### DNS resolver observation

This example requires `dig`, OpenSSL and a network connection:

```bash
echo_dns_token=$(openssl rand -hex 12)
dig "${echo_dns_token}-1.d.echo.nocoo.cloud" A +short +time=3 +tries=1
sleep 3
curl "https://echo-collector.worker.hexly.ai/result/${echo_dns_token}"
```

The response contains `token`, `dns_servers` and `count`. Reporting and KV visibility may be delayed. An empty list can also mean the query did not reach the probe or the record expired; retry with the same token after a short wait. The probe currently listens over UDP and handles A queries under the delegated domain.

On macOS, install the [SwiftBar script](../swiftbar/echo.1m.js) in your SwiftBar plugin directory to display RTT and server processing time. It requires Node.js 18+.

## Development

Install Bun. The DNS probe separately uses the Go toolchain specified in [go.mod](../packages/dns-probe/go.mod). Install workspace dependencies at the repository root, then enter the IP service package:

```bash
git clone https://github.com/nocoo/echo.git
cd echo
bun install --frozen-lockfile
cd packages/ip-service
bun run ipdb:fetch --verify
bun run dev
```

The database download accesses several external providers. Files are stored in the package's `data/` directory by default and are not distributed through Git. The service listens on port `7010` by default.

| Environment variable | Purpose |
| --- | --- |
| `IPDB_DIR` | IP data directory, defaulting to `data` in the working directory; use the same value for download and runtime |
| `STATE_DIR` | Admin console state directory (SQLite `echo.db`), defaulting to `state` in the working directory |
| `DASHBOARD_DIR` | Admin console build output, defaulting to `packages/dashboard/dist` |
| `PORT` | Bun server port, default `7010` |
| `PUBLIC_ORIGIN` | Public origin of the admin console; the only source for the OAuth redirect and the CSRF check |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client credentials |
| `SESSION_SECRET` | Signing secret for the admin session JWT |
| `ALLOWED_EMAILS` | Comma-separated list of emails allowed to sign in; an empty list rejects every login |

### Admin console

The console lives on the same origin under `/admin`. The IP service serves the static build from `DASHBOARD_DIR` when the directory exists; `/admin` and extension-less `/admin/*` fall back to `index.html` while `/api/*` always stays JSON.

Local development is one command from the repository root: the dashboard rebuilds into `packages/dashboard/dist` with `vite build --watch`, and the IP service serves both the API and that build on `:7010`, mirroring production with no second port.

```bash
bun run dev
```

The machine Caddy maps `echo.dev.hexly.ai` to `127.0.0.1:7010`, so open `https://echo.dev.hexly.ai/admin`; the OAuth callback is `https://echo.dev.hexly.ai/api/auth/callback`. The console signs in with Google; an empty `ALLOWED_EMAILS` rejects every login.

`PUBLIC_ORIGIN` must equal the origin you actually open in the browser: `https://echo.dev.hexly.ai` through Caddy, `http://localhost:7010` when hitting the service directly. A mismatch breaks both the OAuth callback URL and the Origin check on mutations.

A direct local request has no proxy-injected IP header. Use this request from another terminal:

```bash
curl 'http://localhost:7010/api/ip' -H 'X-Forwarded-For: 1.1.1.1'
```

Collector has its own package. Run `bun run --cwd packages/collector dev` from the repository root. It uses the `ECHO` KV binding. The DNS probe requires `WORKER_URL` and accepts optional `PORT` and `RESPONSE_IP` values. A separate deployment also needs authoritative DNS delegation. The checked-in domains, Compose file and KV configuration describe the maintainer's environment; replace them with your own resources.

```text
packages/ip-service/    Hono API, IP database readers, download scripts, admin backend and tests
packages/dashboard/     Vite + React admin console (/admin)
packages/collector/     Cloudflare Worker and KV result collection
packages/dns-probe/     Go DNS service and Docker Compose
swiftbar/               macOS menu bar script
docs/                   Design documents and English README
```

The IP service runs as a Docker container on jp4: Cloudflare, then the shared Caddy (Origin certificate plus mTLS), then the container on `:7010`. Once CI passes on `main`, the [deploy workflow](../.github/workflows/deploy.yml) builds a GHCR image through `base-ci` and deploys it. IP databases are not baked into the image; a host timer refreshes them independently. See [deploy/README.md](../deploy/README.md). Other components deploy separately; see the [DNS design document](07-dns-leak-detection.md).

## Tests

Run from the repository root:

| Layer | Command |
| --- | --- |
| IP service unit tests | `bun run --cwd packages/ip-service test` |
| IP service HTTP integration tests | `bun run --cwd packages/ip-service test:e2e` |
| Admin console unit tests | `bun run --cwd packages/dashboard test` |

HTTP tests require every database file in the IP service's `data/` directory. The suite builds the console, takes a random port and uses temporary `STATE_DIR`, `SPOOL_DIR` and `IPDB_DIR` directories whose entries are symlinks to the package data, so it neither occupies `7010` nor leaves state files in the repository. Use `bun run --cwd packages/ip-service test:coverage` to generate a coverage report.

Collector and the DNS probe have no automated test suites, and there are no browser tests. TypeScript checks are available through `bun run --cwd packages/ip-service typecheck` and `bun run --cwd packages/collector typecheck`.

## Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![Go](https://img.shields.io/badge/Go-00ADD8?logo=go&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

| Area | Implementation |
| --- | --- |
| IP API | TypeScript, Bun and Hono; jp4 Docker behind GHCR |
| Admin console | Vite 8, React 19, Tailwind v4 and Basalt; SQLite holds keys and refresh records |
| IP data and caching | ip2region.js, MaxMind MMDB reader and lru-cache |
| DNS probe | Go, miekg/dns and Docker |
| Result collection | Cloudflare Workers and KV |
| Development and tests | Bun workspaces, Vitest, Biome and TypeScript |

Dependency versions are recorded in each package's `package.json`, the root [bun.lock](../bun.lock) and [go.mod](../packages/dns-probe/go.mod).

## Documentation

- [Documentation index](README.md)
- [DNS observation design and deployment](07-dns-leak-detection.md)
- [Logo usage](08-logo-usage.md)
- [Changelog](../CHANGELOG.md)

Earlier documents preserve paths and plans from before the workspace migration. Use this README for current commands and API fields. The `expires_in` field in the DNS design is not implemented.

## License

[MIT](../LICENSE) © 2026 Zheng Li. IP databases have separate data licenses. API responses retain provider attribution in `attribution`; consult each provider's terms before using or redistributing its databases.
