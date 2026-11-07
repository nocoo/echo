import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readDataAge } from "../../src/lib/dataVersion.js";

const NOW = new Date("2026-11-07T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const created: string[] = [];

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "echo-data-age-"));
  created.push(dir);
  return dir;
}

async function touchDaysAgo(dir: string, name: string, days: number): Promise<void> {
  const file = path.join(dir, name);
  const stamp = new Date(NOW.getTime() - days * DAY_MS);
  await writeFile(file, "");
  await utimes(file, stamp, stamp);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("readDataAge", () => {
  test("reports the newest database age", async () => {
    const dir = await makeDir();
    await touchDaysAgo(dir, "ip2region_v4.xdb", 9);
    await touchDaysAgo(dir, "circl-country-asn.mmdb", 2);
    await touchDaysAgo(dir, "notes.txt", 0);

    expect(await readDataAge(dir)).toEqual({ ageDays: 2, stale: false });
  });

  test("ignores non database files", async () => {
    const dir = await makeDir();
    await touchDaysAgo(dir, "readme.md", 0);

    expect(await readDataAge(dir)).toBeNull();
  });

  test("treats data older than the maximum age as stale", async () => {
    const dir = await makeDir();
    await touchDaysAgo(dir, "iplocate-asn.mmdb", 8);

    expect(await readDataAge(dir)).toEqual({ ageDays: 8, stale: true });
  });

  test("keeps data at the maximum age fresh", async () => {
    const dir = await makeDir();
    await touchDaysAgo(dir, "iplocate-asn.mmdb", 7);

    expect(await readDataAge(dir)).toEqual({ ageDays: 7, stale: false });
  });

  test("returns null when the directory is missing", async () => {
    expect(await readDataAge("/nonexistent-echo-data-dir")).toBeNull();
  });

  test("defaults to the configured data directory", async () => {
    const dir = await makeDir();
    await touchDaysAgo(dir, "ip2region_v6.xdb", 1);

    const previous = process.env.IPDB_DIR;
    process.env.IPDB_DIR = dir;
    try {
      expect(await readDataAge()).toEqual({ ageDays: 1, stale: false });
    } finally {
      if (previous === undefined) {
        delete process.env.IPDB_DIR;
      } else {
        process.env.IPDB_DIR = previous;
      }
    }
  });
});
