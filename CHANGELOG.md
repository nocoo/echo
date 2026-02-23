# Changelog

## v1.1.0

### Features

- Rename health endpoint from `/health` to `/api/live`
- `/api/live` now returns service version (`v1.1.0`)
- Add API key gated IP query: `GET /api/ip?ip=x.x.x.x` with `X-Api-Key` header
- Silent fallback to source IP when unauthenticated
- Add root service info endpoint (`GET /`)
- Add IP lookup API with ip2region (`GET /api/ip`)
- Add SwiftBar macOS menu bar plugin for latency monitoring
- Add ipdb fetch and cache script

### Fixes

- Add structured API error responses (`invalid_ip`, `lookup_failed`)
- Add `.js` extensions for Vercel compatibility
- Add SwiftBar globals declaration

### Chores

- Add Vercel and Docker deploy configs
- Add e2e and unit test infrastructure
- Raise API test coverage
- Documentation overhaul
