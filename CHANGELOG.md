# Changelog

## [v2.0.8] - 2026-06-22

### Changed
- Bump @cloudflare/workers-types to 4.20260621.1
- Bump @cloudflare/workers-types 4.20260619.1 → 4.20260620.1 in collector
- Bump wrangler 4.102.0 → 4.103.0 in collector
- Bump @cloudflare/workers-types 4.20260617.1 → 4.20260619.1 in collector
- Bump hono 4.12.25 → 4.12.26 in ip-service
- Pin base-ci reusable workflow to v2026.5 SHA
- Bump wrangler to ^4.102.0 to pull undici 7.28.0
- Bump @cloudflare/workers-types 4.20260616.1 → 4.20260617.1 (#46)
- Bump wrangler 4.100.0 → 4.101.0
- Bump @cloudflare/workers-types 4.20260615.1 → 4.20260616.1
- Bump @cloudflare/workers-types 4.20260613.1 → 4.20260615.1
- Bump typescript-eslint 8.61.0 → 8.61.1
- Bump vitest & @vitest/coverage-v8 4.1.8 → 4.1.9

### Fixed
- Update dbip-city mmdb source to GitHub Releases
- Pin vite & ws via root overrides to patch security advisories

## [v2.0.7] - 2026-06-15

### Changed
- Bump @cloudflare/workers-types 4.20260612.1 → 4.20260613.1
- Bump @cloudflare/workers-types 4.20260611.1 → 4.20260612.1
- Bump eslint 10.4.1 → 10.5.0 in ip-service
- Override esbuild to ^0.28.1 (security)
- Bump collector dev deps
- Bump ip-service deps

### Fixed
- Disable Git-based preview deploys at repo root
- Disable husky in weekly-bump release job
- Add git identity to weekly-bump job
- Drop unsupported working-directory input, use cd in commands

## [v2.0.6] - 2026-06-05

## [v2.0.5] - 2026-06-05

### Added
- Monorepo restructure with DNS leak detection packages
- Add collector package (Cloudflare Worker for DNS results)
- Add dns-probe package (Go authoritative DNS server)

### Changed
- Bump dns-probe alpine runtime 3.21 → 3.23
- Bump dns-probe go directive 1.26.3 → 1.26.4
- Bump dns-probe indirect deps
- Bump collector dev deps
- Bump ip-service patch/minor deps
- Add DNS leak detection usage guide
- Add DNS leak detection infrastructure maintenance guide
- Update workflows for monorepo directory layout
- Restructure as Bun workspace monorepo

### Fixed
- Dns-probe token extraction and collector KV binding
- Deploy from packages/ip-service, remove rootDirectory dependency
- Run vercel deploy from repo root to avoid double rootDirectory
- Use remote Vercel build instead of local prebuilt
- Add includeFiles for data in vercel.json, install rg in CI
- Add DOM lib to tsconfig and update vercel.json for monorepo deploy
- Update release script paths for monorepo layout
- Update ip-service Dockerfile for monorepo build context
- Remove accidentally committed Go binary, update gitignore

### Removed
- Drop bun-types, unify on @types/bun

## [v2.0.4] - 2026-05-25

### Changed
- Fix strict lint violations in test files
- Upgrade ESLint to strict + stylisticTypeChecked

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
