import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Regression guard for the `weekly-bump` job in .github/workflows/release.yml.
//
// Why this test exists:
// A standalone `bun install` step run before `bun run release -- patch --yes`
// rewrites `bun.lock` when the lockfile has drifted from `package.json`
// (e.g. a `^x.y.z` spec whose recorded lockfile entry lost its caret).
// That leaves the working tree dirty, so release.ts preflight aborts with
// `Working tree is not clean. M bun.lock` — the exact failure that broke
// schedule runs 26738243588 (2026-06-01), 27119101762 (2026-06-08), and
// 29233085334 (2026-07-13), and drove STU-1887 / STU-1955.
//
// The release script already runs `bun install` in Phase 1 to sync the
// lockfile against the bumped version and stages `bun.lock` in Phase 4,
// so a pre-release install is both redundant and actively harmful.
// Keep this invariant.

const REPO_ROOT = resolve(import.meta.dirname ?? ".", "../../../..");
const RELEASE_YML = resolve(REPO_ROOT, ".github/workflows/release.yml");

function extractWeeklyBumpJob(yaml: string): string {
  const lines = yaml.split("\n");
  const startIdx = lines.findIndex((l) => /^\s{2}weekly-bump:\s*$/.test(l));
  expect(startIdx, "weekly-bump job header not found").toBeGreaterThanOrEqual(0);

  // Walk until the next top-level (2-space indent) job header, or EOF.
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^\s{2}\S/.test(line) && !/^\s{2}\s/.test(line)) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join("\n");
}

describe("release.yml weekly-bump job", () => {
  const yaml = readFileSync(RELEASE_YML, "utf-8");
  const job = extractWeeklyBumpJob(yaml);

  test("does not run `bun install` before the release script", () => {
    // Any standalone `bun install` step in weekly-bump would run before the
    // release script (there is no post-release install step in this job).
    // Find every `- run:` line and forbid a bare `bun install` command.
    const runSteps = job
      .split("\n")
      .filter((l) => /^\s*-\s+run:\s+/.test(l))
      .map((l) => l.replace(/^\s*-\s+run:\s+/, "").trim());

    const bareBunInstall = runSteps.find((cmd) => /^bun\s+install\b/.test(cmd));
    expect(
      bareBunInstall,
      `weekly-bump must not run \`bun install\` before the release script — ` +
        `release.ts Phase 1 syncs the lockfile and Phase 4 stages it, so a ` +
        `standalone install rewrites bun.lock and dirties the tree. See ` +
        `commit dd62620 / PR #121.`,
    ).toBeUndefined();
  });

  test("invokes the release script with --yes", () => {
    // The scheduled run is non-interactive; `--yes` skips the confirm prompt.
    // Regression guard: don't lose this flag.
    expect(job).toMatch(/bun run release -- patch --yes/);
  });

  test("sets HUSKY=0 so pre-commit hooks don't block the bump commit", () => {
    // The release commit runs husky-managed lint-staged; disabling husky in
    // CI avoids installing dev git hooks on the runner. See commit cf29946.
    expect(job).toMatch(/HUSKY:\s*["']?0["']?/);
  });
});
