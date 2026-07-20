import { describe, expect, test } from "vitest";
import {
  bumpVersion,
  type Commit,
  classifyCommits,
  compareSemver,
  formatChangelogSection,
  parseSemver,
} from "../../scripts/release-utils.js";

describe("parseSemver", () => {
  test("parses valid semver", () => {
    expect(parseSemver("1.2.3")).toEqual([1, 2, 3]);
    expect(parseSemver("0.0.0")).toEqual([0, 0, 0]);
    expect(parseSemver("10.20.30")).toEqual([10, 20, 30]);
  });

  test("throws on invalid semver", () => {
    expect(() => parseSemver("1.2")).toThrow("Invalid semver");
    expect(() => parseSemver("abc")).toThrow("Invalid semver");
    expect(() => parseSemver("1.2.3.4")).toThrow("Invalid semver");
  });
});

describe("compareSemver", () => {
  test("compares major versions", () => {
    expect(compareSemver("2.0.0", "1.0.0")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0", "2.0.0")).toBeLessThan(0);
  });

  test("compares minor versions", () => {
    expect(compareSemver("1.2.0", "1.1.0")).toBeGreaterThan(0);
    expect(compareSemver("1.1.0", "1.2.0")).toBeLessThan(0);
  });

  test("compares patch versions", () => {
    expect(compareSemver("1.0.2", "1.0.1")).toBeGreaterThan(0);
    expect(compareSemver("1.0.1", "1.0.2")).toBeLessThan(0);
  });

  test("returns 0 for equal versions", () => {
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
  });
});

describe("bumpVersion", () => {
  test("bumps patch", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
  });

  test("bumps minor", () => {
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
  });

  test("bumps major", () => {
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
  });

  test("accepts explicit higher version", () => {
    expect(bumpVersion("1.2.3", "2.0.0")).toBe("2.0.0");
  });

  test("throws when explicit version is not higher", () => {
    expect(() => bumpVersion("1.2.3", "1.2.3")).toThrow("must be greater");
    expect(() => bumpVersion("1.2.3", "1.0.0")).toThrow("must be greater");
  });

  test("throws on invalid bump type", () => {
    expect(() => bumpVersion("1.2.3", "invalid")).toThrow("Invalid bump type");
  });
});

describe("classifyCommits", () => {
  test("classifies feat as added", () => {
    const commits: Commit[] = [{ hash: "abc", subject: "feat: add new endpoint" }];
    const result = classifyCommits(commits);
    expect(result.added).toEqual(["Add new endpoint"]);
  });

  test("classifies fix as fixed", () => {
    const commits: Commit[] = [{ hash: "abc", subject: "fix: resolve crash on startup" }];
    const result = classifyCommits(commits);
    expect(result.fixed).toEqual(["Resolve crash on startup"]);
  });

  test("classifies chore/refactor/ci as changed", () => {
    const commits: Commit[] = [
      { hash: "a", subject: "chore: update deps" },
      { hash: "b", subject: "refactor: simplify logic" },
      { hash: "c", subject: "ci: add workflow" },
    ];
    const result = classifyCommits(commits);
    expect(result.changed).toEqual(["Update deps", "Simplify logic", "Add workflow"]);
  });

  test("classifies removal keywords as removed", () => {
    const commits: Commit[] = [{ hash: "abc", subject: "chore: remove deprecated API" }];
    const result = classifyCommits(commits);
    expect(result.removed).toEqual(["Remove deprecated API"]);
  });

  test("skips merge commits", () => {
    const commits: Commit[] = [{ hash: "abc", subject: "Merge pull request #42" }];
    const result = classifyCommits(commits);
    expect(result.added).toEqual([]);
    expect(result.changed).toEqual([]);
    expect(result.fixed).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  test("deduplicates identical descriptions", () => {
    const commits: Commit[] = [
      { hash: "a", subject: "feat: add button" },
      { hash: "b", subject: "feat: add button" },
    ];
    const result = classifyCommits(commits);
    expect(result.added).toEqual(["Add button"]);
  });

  test("handles scoped conventional commits", () => {
    const commits: Commit[] = [{ hash: "a", subject: "feat(auth): add login" }];
    const result = classifyCommits(commits);
    expect(result.added).toEqual(["Add login"]);
  });

  test("handles non-conventional commits as changed", () => {
    const commits: Commit[] = [{ hash: "a", subject: "update something" }];
    const result = classifyCommits(commits);
    expect(result.changed).toEqual(["Update something"]);
  });
});

describe("formatChangelogSection", () => {
  test("formats with v prefix", () => {
    const sections = {
      added: ["New feature"],
      changed: [],
      fixed: ["Bug fix"],
      removed: [],
    };
    const result = formatChangelogSection("1.2.0", "2026-01-01", sections, true);
    expect(result).toContain("## [v1.2.0] - 2026-01-01");
    expect(result).toContain("### Added");
    expect(result).toContain("- New feature");
    expect(result).toContain("### Fixed");
    expect(result).toContain("- Bug fix");
    expect(result).not.toContain("### Changed");
    expect(result).not.toContain("### Removed");
  });

  test("formats without v prefix", () => {
    const sections = {
      added: ["Feature"],
      changed: [],
      fixed: [],
      removed: [],
    };
    const result = formatChangelogSection("1.2.0", "2026-01-01", sections, false);
    expect(result).toContain("## [1.2.0] - 2026-01-01");
  });

  test("omits empty sections", () => {
    const sections = {
      added: [],
      changed: ["Something changed"],
      fixed: [],
      removed: [],
    };
    const result = formatChangelogSection("1.0.0", "2026-01-01", sections, true);
    expect(result).not.toContain("### Added");
    expect(result).toContain("### Changed");
    expect(result).not.toContain("### Fixed");
    expect(result).not.toContain("### Removed");
  });
});
