# Retrospective

Accident narratives and original lessons. Historical instructions below describe their time; the current handbook and its local-isolation contract take precedence.

## 2026-11-14 — Inspect generated locks and browser fixture state

The Basalt upgrade install wrote Tencent tarball URLs into unrelated lock entries. The first local dependency commit included that noise; before any push, it was amended to retain the preceding records and only the requested Basalt version/integrity change. Always inspect and normalize generated registry locations before staging, then verify frozen installation. A subsequent normalization draft matched override keys as package records and made the lock invalid; it was restored from the task-owned snapshot and corrected to match package-array records only.

The new browser fixture initially allocated a different random port when Playwright workers loaded the configuration again. Allocate once in the runner and pass the selected port to workers. Inspect the published DOM before writing selectors: Avatar has no avatar data-slot, collapsed markers are empty attributes, and modal dialogs hide the opener from accessibility queries while open.

The first report incorrectly treated computed `display:flex` on collapsed brand copy as proof that its text remained visible. The actual browser hidden assertion passed; computed display alone does not establish rendered visibility. The remaining desktop failure was an unnamed navigation link: the application router adapter dropped aria attributes, click callbacks and refs. Forward the complete anchor contract and verify accessible names, routing, callbacks and focus with regressions rather than weakening a semantic locator.

The outer drawer measured 320px, not the original 260px criterion. The user subsequently approved outer320/inner260 acceptance while retaining all other assertions. Record that as an explicit acceptance change, not a library fix. Preserve historical failures but rerun the corrected criteria before claiming success.

HTTP tests previously downloaded provider databases into the package and symlinked those files into temporary directories. Generate small synthetic XDB/MMDB binaries per run instead, exercise the actual readers and HTTP server, and wait for server exit before removing state. Fixture expectations must follow existing product behavior: an unmatched XDB search is parsed to an empty location object while unmatched MMDB records are null.

Review found that random ports alone did not isolate the first test harness: both suites still built into the shared dashboard dist. Give each run its own build output as well as ports/state/results. Concurrent HTTP/browser runs now preserve the shared development index hash. Also inspect the exact pinned reusable CI inputs before declaring a slot implemented: browser checks must enable the dedicated browser job, not merely run inside the HTTP job while declaring the browser slot implemented.

## Undated entries migrated from CLAUDE.md

- **JSON import attribute**: Bun silently accepts `import x from "./foo.json"`, but Node.js (used by Vercel) requires `with { type: "json" }`. Always use the import attribute for cross-runtime compatibility.
- **Vercel env var trailing newline**: `echo 'value' | vercel env add` appends `\n` to the value. Use `printf 'value' | vercel env add` instead to avoid silent auth mismatches.
- **Vercel rootDirectory vs CI working-directory**: Don't set both — Vercel CLI doubles the path. Use `working-directory` in CI workflow only; leave Vercel Root Directory empty for CLI-based deploys.
- **Vercel build sandbox lacks bun**: `vercel build` in CI can't find bun (ENOENT). Use `vercel deploy --prod` (remote build on Vercel servers) instead of `vercel build && vercel deploy --prebuilt`.


## 2026-10-02 — Verify floating dependency drift

A targeted undici update also advanced @types/bun and bun-types because the IP service declares latest. That unrelated change was detected before review/publication and restored from the exact preceding lockfile records, including integrity values. Frozen installation and normal hooks verify consistency. Inspect effective lock deltas rather than assuming a successful targeted install changes only the requested package.

The first isolated HTTP run failed readiness and executed no API cases: resolveDataFile also prefixed cwd to an absolute IPDB_DIR. A focused absolute-directory regression failed before the fix. Resolve that configured directory directly, then rerun the full local suite and normal pre-push. The timeout and skipped cases remain failure evidence, not successful validation.
