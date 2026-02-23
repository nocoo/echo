README.md

## Retrospective

- **JSON import attribute**: Bun silently accepts `import x from "./foo.json"`, but Node.js (used by Vercel) requires `with { type: "json" }`. Always use the import attribute for cross-runtime compatibility.
- **Vercel env var trailing newline**: `echo 'value' | vercel env add` appends `\n` to the value. Use `printf 'value' | vercel env add` instead to avoid silent auth mismatches.
