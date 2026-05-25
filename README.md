# echo

An API-only IP lookup service for Vercel. Queries 4 data sources in parallel, selects the best result, and returns structured location data with sub-millisecond latency.

## Features

- Multi-provider parallel IP lookup (ip2region, iplocate, ip-location-db, CIRCL)
- Best-answer selection: prefers ip2region for Chinese IPs, ip-location-db for international
- ASN enrichment across providers
- LRU cache (100 entries, 10min TTL)
- IPv4 and IPv6 support
- API key authentication for arbitrary IP lookups
- Weekly automated deployment keeps IP databases fresh

## API

### `GET /api/ip`

Returns IP location for the requesting client.

```json
{
  "ip": "1.2.3.4",
  "version": 4,
  "location": {
    "country": "China",
    "countryCode": "CN",
    "province": "Jiangsu",
    "city": "Nanjing",
    "latitude": 32.06,
    "longitude": 118.79,
    "isp": "China Telecom",
    "asn": 4134,
    "asOrg": "CHINANET-BACKBONE"
  },
  "source": "ip2region",
  "attribution": [
    "IP2Region data provided by https://ip2region.net (Apache-2.0).",
    "ip-location-db data provided by https://github.com/sapics/ip-location-db (CC BY-SA 4.0).",
    "IPLocate data provided by https://iplocate.io (CC BY-SA 4.0).",
    "CIRCL data provided by https://www.circl.lu (open data)."
  ],
  "latencyMs": 2
}
```

### `GET /api/ip?detail=true`

Returns all provider results in addition to the selected best result:

```json
{
  "ip": "1.2.3.4",
  "version": 4,
  "location": { "..." },
  "source": "ip2region",
  "attribution": ["..."],
  "latencyMs": 3,
  "providers": [
    { "name": "ip2region", "attribution": "...", "location": { "..." }, "latencyMs": 1 },
    { "name": "iplocate", "attribution": "...", "location": { "..." }, "latencyMs": 2 },
    { "name": "ip-location-db", "attribution": "...", "location": { "..." }, "latencyMs": 3 },
    { "name": "circl", "attribution": "...", "location": { "..." }, "latencyMs": 1 }
  ]
}
```

### `GET /api/ip?ip=x.x.x.x`

Look up a specific IP (requires `X-Api-Key` header matching `ECHO_API_KEY` env var).

### `GET /api/live`

Health check. Returns `status`, `version`, `uptime`.

### `GET /`

Service info with available endpoints.

## Data Sources

| Provider | Data | License |
|----------|------|---------|
| [ip2region](https://ip2region.net) | Country, province, city, ISP (best for China) | Apache-2.0 |
| [iplocate](https://iplocate.io) | ASN, country | CC BY-SA 4.0 |
| [ip-location-db](https://github.com/sapics/ip-location-db) | City, coordinates, ASN | CC BY-SA 4.0 |
| [CIRCL](https://www.circl.lu) | Country, ASN | Open data |

## Run locally

```bash
bun install
bun run ipdb:fetch        # download all 7 database files
bun run dev               # start on port 7010
```

Verify databases after download:

```bash
bun run ipdb:fetch --verify
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `IPDB_DIR` | `data` | Directory for database files |
| `ECHO_API_KEY` | — | Enables authenticated IP query via `?ip=` |
| `PORT` | `7010` | Server port |

## Deploy

### Vercel (recommended)

Uses `vercel.json`. Build step downloads all databases and bundles them.

GitHub Actions workflow (`.github/workflows/release.yml`) handles:
- Deploy on version tags (`v*`)
- Weekly Monday deploy (fresh IP data)
- Manual dispatch

Required secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## Tests

```bash
bun run test              # unit tests
bun run test:coverage     # with coverage (95% threshold)
bun run test:e2e          # e2e (requires ipdb:fetch first)
bun run typecheck         # type checking
```

## SwiftBar plugin

Menu bar latency monitor for macOS: `swiftbar/echo.1m.js`

## Project structure

- `src/services/providers/` — IP data providers
- `src/services/selectBest.ts` — best-answer selection logic
- `src/services/cache.ts` — LRU cache
- `src/services/ipLookup.ts` — parallel query orchestrator
- `src/server.ts` — Hono HTTP routes
- `scripts/ipdb-fetch.ts` — database downloader
- `tests/` — unit + e2e tests
