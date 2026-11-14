# Tests and coverage

Run from the repository root with Bun 1.4.2:

```sh
bun run --cwd packages/ip-service typecheck
bun run --cwd packages/collector typecheck
bun run --cwd packages/dashboard typecheck
bun run lint
bun run --cwd packages/ip-service test:coverage
bun run --cwd packages/dashboard test:coverage
bun run --cwd packages/ip-service test:e2e
bun run --cwd packages/dashboard playwright install chromium
bun run --cwd packages/dashboard test:e2e
```

## Gates

- IP-service and dashboard unit coverage require statements, branches, functions and lines each at least 95%. Dashboard coverage targets its library/view-model modules; it does not imply full presentation coverage.
- Pre-commit checks an index snapshot with types, coverage, check-only lint and staged secret scanning.
- Pre-push runs unit tests, check-only lint, real HTTP integration, browser E2E and OSV. CI independently runs these checks; the browser suite runs in the L2 job after installing Chromium.
- Lint requires zero warnings and zero errors. No skipped or focused tests are permitted.

## Isolated HTTP fixtures

The HTTP suite builds the dashboard, creates temporary state/spool/database directories and starts the actual Bun service on a random port. It generates synthetic XDB and MMDB binary files for a small fixed address set, then exercises the production readers. It never downloads provider data, opens daily databases or writes remote resources. The suite validates its server instance ID and waits for shutdown before removing its directories.

All original HTTP assertions remain. Additional checks require all four providers to return fixture records for the known IPv4 address, verify unmatched addresses have only empty/null provider data, and exercise an IPv6 XDB record. These tests establish transport/reader integration, not real-world geolocation accuracy.

## Browser fixtures

Playwright builds the real dashboard and starts its own preview server on a random local port. Traces/results use a per-run temporary directory. Every API response is synthetic; unexpected API calls fail rather than reaching a daily backend. OAuth authorization and key lifecycle remain covered by their existing unit tests, while real signed-in avatar acceptance is manual.

The six sidebar cases retain light/dark themes, desktop and 390/700px mobile widths. They assert avatar36x36/equal-y, email16px, hidden collapsed brand, routing/sign-out, zero drawer padding, first-Escape dismissal, focus return and desktop collapse independence. The user approved changing acceptance from outer drawer260px to outer320px; the inner sidebar remains260px. This is an acceptance amendment, not an upstream geometry fix or a pass against the old criterion.
