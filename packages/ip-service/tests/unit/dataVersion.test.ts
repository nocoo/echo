import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { readDataRefreshedAt } from "../../src/lib/dataVersion.js";

const created: string[] = [];

async function makeDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "echo-data-version-"));
  created.push(dir);
  return dir;
}

async function touch(dir: string, name: string, iso: string): Promise<void> {
  const file = path.join(dir, name);
  await writeFile(file, "");
  await utimes(file, new Date(iso), new Date(iso));
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("readDataRefreshedAt", () => {
  test("returns the newest database mtime and ignores other files", async () => {
    const dir = await makeDir();
    await touch(dir, "ip2region_v4.xdb", "2026-01-01T00:00:00.000Z");
    await touch(dir, "circl-country-asn.mmdb", "2026-03-04T05:06:07.000Z");
    await touch(dir, "notes.txt", "2027-01-01T00:00:00.000Z");

    expect(await readDataRefreshedAt(dir)).toBe("2026-03-04T05:06:07.000Z");
  });

  test("returns null when the directory has no database files", async () => {
    const dir = await makeDir();
    await touch(dir, "readme.md", "2026-01-01T00:00:00.000Z");

    expect(await readDataRefreshedAt(dir)).toBeNull();
  });

  test("returns null when the directory is missing", async () => {
    expect(await readDataRefreshedAt("/nonexistent-echo-data-dir")).toBeNull();
  });

  test("defaults to the configured data directory", async () => {
    const dir = await makeDir();
    await touch(dir, "ip2region_v6.xdb", "2026-05-06T07:08:09.000Z");

    const previous = process.env.IPDB_DIR;
    process.env.IPDB_DIR = dir;
    try {
      expect(await readDataRefreshedAt()).toBe("2026-05-06T07:08:09.000Z");
    } finally {
      if (previous === undefined) {
        delete process.env.IPDB_DIR;
      } else {
        process.env.IPDB_DIR = previous;
      }
    }
  });
});
