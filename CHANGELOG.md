# Changelog

## [v2.0.3] - 2026-05-25

### Fixed
- Use production domain for health check with retry

## [v2.0.2] - 2026-05-25

### Added
- Compress data files at build, decompress to /tmp at runtime

### Changed
- Ignore .claude/ directory

## [v2.0.1] - 2026-05-25

### Added
- Expand fetch script to download all 4 provider databases
- Parallel query orchestrator with best-answer selection
- Add LRU cache (100 entries, 10min TTL) for lookup results
- Implement CirclProvider for country + ASN lookup
- Implement IpLocationDbProvider for city + ASN lookup
- Implement IplocateProvider for ASN + country lookup
- Add shared MMDB reader utility with singleton cache
- Expand IpLocation schema with geo coordinates and ASN fields

### Changed
- Disable Vercel Git auto-deploy, deploy only via release CI
- Add commands & version management sections to CLAUDE.md
- Check all MMDB files and validate multi-provider response
- Update development guide for multi-provider 2.0 architecture
- Update README and clean up dead code for multi-provider architecture
- Add release workflow with Vercel CLI deploy and weekly cron
- Document IP_PROVIDER env var and supported values
- Use provider metadata in API response instead of hardcoded values
- Wire ipLookup to use IpProvider abstraction
- Add provider factory with env-var selection
- Implement Ip2RegionProvider wrapping existing ipdb logic
- Add IpProvider interface and source-agnostic IpLocation model

### Fixed
- Empty-location ip2region no longer wins over valid providers
- SelectBest no longer mutates original ProviderResult
- ASN-only ip-location-db no longer wins over complete results
- Return 500 when all providers fail instead of silent 200
- Fail fast on unsupported IP_PROVIDER at app startup

## [v1.1.2] - 2026-05-24

### Added
- Upgrade /api/live to surety standard
- Add automated release script

### Changed
- Bump base-ci to v2026.2 with ignore-scripts (Shai-Hulud defense)
- Enable L2 gate in CI
- Enforce L1 coverage gate in hook and CI
- Migrate from bun test to vitest with 95% coverage
- Upgrade base-ci to v2026.1
- Add G2 security scanning (gitleaks + osv-scanner)
- Add typecheck script + lint-staged
- Ignore GHSA-458j-xx4x-4375 hono medium CVE
- 6DQ L1+G1 — coverage threshold + max-warnings=0 (#1)
- Strengthen pre-commit and pre-push hooks
- Migrate to nocoo/base-ci@v2026
- Add GitHub Actions CI workflow
- Migrate dev port 7012 → 7010
- Add vercel env var trailing newline retrospective
- Add json import attribute retrospective

### Fixed
- Upgrade all dependencies
- Upgrade hono to fix CVE
- Resolve e2e test dependency issue
- Upgrade hono to fix GHSA-458j-xx4x-4375
- 迁移到 base-ci@v2026，禁用 L2 E2E
- Update hono + ignore indirect CVEs
- Add json import attribute for node.js compatibility

### Removed
- Remove stale hono CVE ignores from osv-scanner.toml

## [v1.1.1] - 2026-05-24

### Added
- Upgrade /api/live to surety standard
- Add automated release script

### Changed
- Bump base-ci to v2026.2 with ignore-scripts (Shai-Hulud defense)
- Enable L2 gate in CI
- Enforce L1 coverage gate in hook and CI
- Migrate from bun test to vitest with 95% coverage
- Upgrade base-ci to v2026.1
- Add G2 security scanning (gitleaks + osv-scanner)
- Add typecheck script + lint-staged
- Ignore GHSA-458j-xx4x-4375 hono medium CVE
- 6DQ L1+G1 — coverage threshold + max-warnings=0 (#1)
- Strengthen pre-commit and pre-push hooks
- Migrate to nocoo/base-ci@v2026
- Add GitHub Actions CI workflow
- Migrate dev port 7012 → 7010
- Add vercel env var trailing newline retrospective
- Add json import attribute retrospective

### Fixed
- Upgrade hono to fix CVE
- Resolve e2e test dependency issue
- Upgrade hono to fix GHSA-458j-xx4x-4375
- 迁移到 base-ci@v2026，禁用 L2 E2E
- Update hono + ignore indirect CVEs
- Add json import attribute for node.js compatibility

### Removed
- Remove stale hono CVE ignores from osv-scanner.toml

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
