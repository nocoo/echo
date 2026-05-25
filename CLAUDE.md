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
- Tag format: `v{version}` — triggers CI deploy on push
- Release script: `scripts/release.ts` — bumps version, generates CHANGELOG, tags, pushes, creates GitHub release
- Requires: `gh` CLI (authenticated), `rg` (ripgrep)

## Retrospective

- **JSON import attribute**: Bun silently accepts `import x from "./foo.json"`, but Node.js (used by Vercel) requires `with { type: "json" }`. Always use the import attribute for cross-runtime compatibility.
- **Vercel env var trailing newline**: `echo 'value' | vercel env add` appends `\n` to the value. Use `printf 'value' | vercel env add` instead to avoid silent auth mismatches.
