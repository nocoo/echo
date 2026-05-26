README.md

## Commands

| Command | Description |
|---------|-------------|
| `bun run release` | Patch release (default) |
| `bun run release -- minor` / `major` / `x.y.z` | Other bump types |
| `bun run release -- --dry-run` | Preview without side effects |
| `bun run ipdb:fetch` | Download IP databases only |
| `bun run ipdb:update` | Fetch + verify + patch release |

## Version Management

- Source of truth: `package.json` → `src/lib/version.ts` (generated)
- Tag format: `v{version}` — triggers CI deploy via `release.yml` (Vercel CLI)
- Vercel Git auto-deploy is disabled (`vercel.json`); only CI deploys to production
- Release script: `scripts/release.ts` — bumps version, generates CHANGELOG, tags, pushes, creates GitHub release
- Requires: `gh` CLI (authenticated), `rg` (ripgrep)

## DNS Leak Detection Infrastructure

### Components

| Component | Location | Address |
|-----------|----------|---------|
| dns-probe | jp2.nocoo.cloud (Docker) | 74.226.88.37:53/UDP |
| collector | Cloudflare Worker | echo-collector.worker.hexly.ai |
| NS delegation | Cloudflare DNS | `d.echo.nocoo.cloud` → `ns1.echo.nocoo.cloud` |

### dns-probe Maintenance (jp2)

```bash
# SSH access
ssh -p 52722 nocoo@jp2.nocoo.cloud

# Logs
cd ~/echo/packages/dns-probe
docker compose logs -f

# Update code and rebuild
cd ~/echo && git pull
cd packages/dns-probe && docker compose up -d --build

# Restart without rebuild
docker compose restart

# Status check
docker compose ps
```

- Container has `restart: unless-stopped` — survives VPS reboot
- `systemd-resolved` stub listener disabled (`DNSStubListener=no` in `/etc/systemd/resolved.conf`)
- UFW rule: `53/udp ALLOW` (comment: DNS-probe)
- WORKER_URL: `https://echo-collector.worker.hexly.ai`

### collector Worker Maintenance

```bash
# Deploy (from packages/collector/)
cd packages/collector && npx wrangler deploy

# Tail logs
npx wrangler tail echo-collector

# KV inspection
npx wrangler kv key list --binding ECHO
npx wrangler kv key get --binding ECHO "dns:<token>"
```

- KV namespace: `echo` (id: `c8b08f1809d2416db8f2c0270c0a04a9`)
- TTL: 300s per token entry

### NS Records (Cloudflare)

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| NS | `d` | `ns1.echo.nocoo.cloud` | Off |
| A | `ns1` | `74.226.88.37` | Off |

If jp2 IP changes, update both the `ns1` A record and Uptime Kuma monitoring.

## Retrospective

- **JSON import attribute**: Bun silently accepts `import x from "./foo.json"`, but Node.js (used by Vercel) requires `with { type: "json" }`. Always use the import attribute for cross-runtime compatibility.
- **Vercel env var trailing newline**: `echo 'value' | vercel env add` appends `\n` to the value. Use `printf 'value' | vercel env add` instead to avoid silent auth mismatches.
- **Vercel rootDirectory vs CI working-directory**: Don't set both — Vercel CLI doubles the path. Use `working-directory` in CI workflow only; leave Vercel Root Directory empty for CLI-based deploys.
- **Vercel build sandbox lacks bun**: `vercel build` in CI can't find bun (ENOENT). Use `vercel deploy --prod` (remote build on Vercel servers) instead of `vercel build && vercel deploy --prebuilt`.
