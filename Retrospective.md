# Retrospective

Accident narratives and original lessons. Historical instructions below describe their time; the current handbook and its local-isolation contract take precedence.

## Undated entries migrated from CLAUDE.md

- **JSON import attribute**: Bun silently accepts `import x from "./foo.json"`, but Node.js (used by Vercel) requires `with { type: "json" }`. Always use the import attribute for cross-runtime compatibility.
- **Vercel env var trailing newline**: `echo 'value' | vercel env add` appends `\n` to the value. Use `printf 'value' | vercel env add` instead to avoid silent auth mismatches.
- **Vercel rootDirectory vs CI working-directory**: Don't set both — Vercel CLI doubles the path. Use `working-directory` in CI workflow only; leave Vercel Root Directory empty for CLI-based deploys.
- **Vercel build sandbox lacks bun**: `vercel build` in CI can't find bun (ENOENT). Use `vercel deploy --prod` (remote build on Vercel servers) instead of `vercel build && vercel deploy --prebuilt`.


## 2026-10-02 — Verify floating dependency drift

A targeted undici update also advanced @types/bun and bun-types because the IP service declares latest. That unrelated change was detected before review/publication and restored from the exact preceding lockfile records, including integrity values. Frozen installation and normal hooks verify consistency. Inspect effective lock deltas rather than assuming a successful targeted install changes only the requested package.

The first isolated HTTP run failed readiness and executed no API cases: resolveDataFile also prefixed cwd to an absolute IPDB_DIR. A focused absolute-directory regression failed before the fix. Resolve that configured directory directly, then rerun the full local suite and normal pre-push. The timeout and skipped cases remain failure evidence, not successful validation.
