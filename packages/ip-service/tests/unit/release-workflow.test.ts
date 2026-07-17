import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

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

interface WorkflowStep {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
  "working-directory"?: string;
}

interface WorkflowJob {
  if?: string;
  steps?: WorkflowStep[];
  defaults?: { run?: { "working-directory"?: string } };
}

interface Workflow {
  jobs: Record<string, WorkflowJob>;
}

function loadWeeklyBumpJob(): WorkflowJob {
  const doc = parseYaml(readFileSync(RELEASE_YML, "utf-8")) as Workflow;
  const job = doc.jobs?.["weekly-bump"];
  if (!job) {
    throw new Error("weekly-bump job missing from release.yml");
  }
  if (!Array.isArray(job.steps)) {
    throw new Error("weekly-bump.steps must be a list");
  }
  return job;
}

// Extract every command a shell step will execute. A YAML `run:` value is a
// single string that may hold:
//   - one command:            `bun install`
//   - a `&&` / `;` chain:     `sudo apt-get update && sudo apt-get install ...`
//   - a multi-line block:     `run: |\n  cmd1\n  cmd2\n`
// Flatten to individual commands so a nested `bun install` inside a chain
// or block cannot slip past the guard.
function commandsOf(run: string): string[] {
  return run
    .split("\n")
    .flatMap((line) => line.split(/&&|;/))
    .map((c) => c.replace(/^\s*(?:sudo\s+)?/, "").trim())
    .filter((c) => c && !c.startsWith("#"));
}

function findBunInstallOffenders(steps: WorkflowStep[]): string[] {
  return steps
    .filter((s): s is WorkflowStep & { run: string } => typeof s.run === "string")
    .flatMap((s) => commandsOf(s.run))
    .filter((cmd) => /^bun\s+install\b/.test(cmd));
}

describe("release.yml weekly-bump job", () => {
  const job = loadWeeklyBumpJob();
  const steps: WorkflowStep[] = job.steps ?? [];
  const runSteps = steps.filter((s): s is WorkflowStep & { run: string } =>
    typeof s.run === "string",
  );

  test("does not run `bun install` anywhere in the job", () => {
    // release.ts Phase 1 already syncs the lockfile; any extra install would
    // dirty the tree and abort preflight. See commit dd62620 / PR #121.
    const offenders = findBunInstallOffenders(steps);
    expect(
      offenders,
      `weekly-bump must not run \`bun install\`. Offending commands: ${JSON.stringify(offenders)}`,
    ).toEqual([]);
  });

  test("invokes the release script with --yes (non-interactive)", () => {
    // The scheduled run has no TTY; --yes skips the confirm prompt.
    const releaseStep = runSteps.find((s) => /bun\s+run\s+release\b/.test(s.run));
    expect(releaseStep?.run, "release step missing").toMatch(
      /bun run release -- patch --yes/,
    );
  });

  test("sets HUSKY=0 on the release step so pre-commit hooks skip", () => {
    // husky-managed hooks would otherwise fire during the release commit and
    // require dev deps not installed on the runner. See commit cf29946.
    const releaseStep = runSteps.find((s) => /bun\s+run\s+release\b/.test(s.run));
    expect(releaseStep, "release step missing").toBeTruthy();
    expect(String(releaseStep?.env?.HUSKY)).toBe("0");
  });

  test("is scoped to scheduled runs (not workflow_dispatch)", () => {
    // `gh workflow run release.yml` fires workflow_dispatch, which this job
    // skips. Anyone verifying weekly-bump needs the cron trigger, not dispatch.
    expect(job.if).toMatch(/github\.event_name\s*==\s*['"]schedule['"]/);
  });
});

// Adversarial cases for findBunInstallOffenders — every shape that has slipped
// past a naïver detector, driven off synthetic step lists so we don't have to
// mutate release.yml on disk.
describe("findBunInstallOffenders adversarial shapes", () => {
  test("catches a bare `run: bun install`", () => {
    expect(findBunInstallOffenders([{ run: "bun install" }])).toEqual(["bun install"]);
  });

  test("catches a named step with `run: bun install`", () => {
    // The exact reproducer Reviewer-02 called out in STU-1955.
    expect(
      findBunInstallOffenders([
        { name: "Install dependencies", run: "bun install" },
      ]),
    ).toEqual(["bun install"]);
  });

  test("catches `bun install --frozen-lockfile` (variants of the offending command)", () => {
    expect(
      findBunInstallOffenders([{ run: "bun install --frozen-lockfile" }]),
    ).toEqual(["bun install --frozen-lockfile"]);
  });

  test("catches `bun install` chained after another command with `&&`", () => {
    const offenders = findBunInstallOffenders([
      { run: "sudo apt-get install -y ripgrep && bun install" },
    ]);
    expect(offenders).toContain("bun install");
  });

  test("catches `bun install` nested inside a `|` block scalar", () => {
    // YAML block scalars are the most common shape used for multi-command
    // steps ("Configure and install"), and the shape a regex over raw
    // `- run:` lines misses entirely.
    const offenders = findBunInstallOffenders([
      {
        name: "Install and prep",
        run: "bun install\necho done",
      },
    ]);
    expect(offenders).toContain("bun install");
  });

  test("ignores steps that use actions (no `run:` key)", () => {
    expect(
      findBunInstallOffenders([
        { uses: "actions/checkout@v4" },
        { uses: "oven-sh/setup-bun@v2" },
      ]),
    ).toEqual([]);
  });

  test("ignores unrelated shell commands (checkout, git config, apt-get, bun run …)", () => {
    // Bun commands that are *not* install must not false-positive; likewise
    // `sudo apt-get install` targets a different binary and stays clean.
    expect(
      findBunInstallOffenders([
        { run: "git config user.name nocoo" },
        { run: "sudo apt-get install -y ripgrep" },
        { run: "bun run release -- patch --yes" },
        { run: "bun test" },
      ]),
    ).toEqual([]);
  });
});
