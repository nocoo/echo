import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { openMock } = vi.hoisted(() => ({ openMock: vi.fn() }));

vi.mock("maxmind", () => ({
  default: { open: openMock },
}));

const { DATA_MANIFEST, readDataInventory, summarizeInventory } = await import(
  "../../src/lib/dataInventory.js"
);

const DAY_MS = 24 * 60 * 60 * 1000;

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "echo-data-"));
  openMock.mockReset();
  openMock.mockImplementation(async (filePath: string) => {
    if (filePath.endsWith("circl-country-asn.mmdb")) {
      throw new Error("not a mmdb file");
    }
    if (filePath.endsWith("iplocate-country.mmdb")) {
      return { metadata: { buildEpoch: 1_700_000_000 } };
    }
    return { metadata: { buildEpoch: new Date("2026-01-02T03:04:05.000Z") } };
  });
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

function writeAgedFile(name: string, ageMs: number, now: number): void {
  const file = path.join(dataDir, name);
  writeFileSync(file, "x");
  const at = new Date(now - ageMs);
  utimesSync(file, at, at);
}

describe("data inventory", () => {
  test("reports every manifest entry as missing when the directory is empty", async () => {
    const entries = await readDataInventory(dataDir);

    expect(entries).toHaveLength(DATA_MANIFEST.length);
    expect(entries.every((entry) => entry.status === "missing")).toBe(true);
    expect(entries.every((entry) => entry.present === false)).toBe(true);
    expect(entries.every((entry) => entry.size === null)).toBe(true);
    expect(entries.every((entry) => entry.ageDays === null)).toBe(true);
    expect(entries.every((entry) => entry.buildDate === null)).toBe(true);
  });

  test("describes present files with their own age", async () => {
    writeFileSync(path.join(dataDir, "ip2region_v4.xdb"), "xdb");
    writeFileSync(path.join(dataDir, "iplocate-asn.mmdb"), "mmdb");

    const entries = await readDataInventory(dataDir);
    const byName = new Map(entries.map((entry) => [entry.filename, entry]));

    const xdb = byName.get("ip2region_v4.xdb");
    expect(xdb?.present).toBe(true);
    expect(xdb?.size).toBe(3);
    expect(xdb?.ageDays).toBe(0);
    expect(xdb?.status).toBe("ok");
    expect(xdb?.provider).toBe("ip2region");
    expect(xdb?.url).toContain("ip2region_v4.xdb");
    expect(xdb?.buildDate).toBeNull();

    const mmdb = byName.get("iplocate-asn.mmdb");
    expect(mmdb?.buildDate).toBe("2026-01-02");
    expect(mmdb?.modifiedAt).not.toBeNull();
  });

  test("marks files older than a week as stale", async () => {
    const file = path.join(dataDir, "ip2region_v4.xdb");
    writeFileSync(file, "xdb");
    const old = (Date.now() - 10 * DAY_MS) / 1000;
    utimesSync(file, old, old);

    const entries = await readDataInventory(dataDir);
    const xdb = entries.find((entry) => entry.filename === "ip2region_v4.xdb");

    expect(xdb?.ageDays).toBe(10);
    expect(xdb?.status).toBe("stale");
  });

  test("keeps the build date empty when the mmdb cannot be read", async () => {
    writeFileSync(path.join(dataDir, "circl-country-asn.mmdb"), "broken");

    const entries = await readDataInventory(dataDir);
    const circl = entries.find((entry) => entry.filename === "circl-country-asn.mmdb");

    expect(circl?.buildDate).toBeNull();
    expect(circl?.status).toBe("ok");
  });

  test("keeps the build date empty when the build epoch is not a date", async () => {
    writeFileSync(path.join(dataDir, "iplocate-country.mmdb"), "mmdb");

    const entries = await readDataInventory(dataDir);
    const country = entries.find((entry) => entry.filename === "iplocate-country.mmdb");

    expect(country?.buildDate).toBeNull();
  });

  test("uses the data directory from the environment by default", async () => {
    const previous = process.env.IPDB_DIR;
    process.env.IPDB_DIR = dataDir;
    try {
      writeFileSync(path.join(dataDir, "ip2region_v4.xdb"), "xdb");
      const entries = await readDataInventory();
      expect(entries.find((entry) => entry.filename === "ip2region_v4.xdb")?.present).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.IPDB_DIR;
      else process.env.IPDB_DIR = previous;
    }
  });
});

describe("inventory summary", () => {
  test("counts present and missing files", async () => {
    writeFileSync(path.join(dataDir, "ip2region_v4.xdb"), "xdb");
    const entries = await readDataInventory(dataDir);

    const summary = summarizeInventory(entries);
    expect(summary.present).toBe(1);
    expect(summary.missing).toBe(DATA_MANIFEST.length - 1);
    expect(summary.ageDays).toBe(0);
    expect(summary.stale).toBe(false);
  });

  test("reports no age when nothing is present", async () => {
    const entries = await readDataInventory(dataDir);
    const summary = summarizeInventory(entries);

    expect(summary.present).toBe(0);
    expect(summary.ageDays).toBeNull();
    expect(summary.stale).toBe(false);
  });

  test("reports staleness from the newest file", async () => {
    const file = path.join(dataDir, "ip2region_v4.xdb");
    writeFileSync(file, "xdb");
    const old = (Date.now() - 30 * DAY_MS) / 1000;
    utimesSync(file, old, old);

    const entries = await readDataInventory(dataDir);
    const summary = summarizeInventory(entries);

    expect(summary.ageDays).toBe(30);
    expect(summary.stale).toBe(true);
  });

  test("aggregates with the newest file when ages are mixed", async () => {
    const now = Date.parse("2026-06-01T00:00:00.000Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      writeAgedFile("ip2region_v4.xdb", DAY_MS, now);
      writeAgedFile("iplocate-asn.mmdb", 30 * DAY_MS, now);

      const summary = summarizeInventory(await readDataInventory(dataDir));

      expect(summary.ageDays).toBe(1);
      expect(summary.stale).toBe(false);
      expect(summary.present).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("keeps a file that is exactly seven days old fresh", async () => {
    const now = Date.parse("2026-06-01T00:00:00.000Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      writeAgedFile("ip2region_v4.xdb", 7 * DAY_MS, now);

      const summary = summarizeInventory(await readDataInventory(dataDir));

      expect(summary.ageDays).toBe(7);
      expect(summary.stale).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("marks a file that is one second past seven days stale", async () => {
    const now = Date.parse("2026-06-01T00:00:00.000Z");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    try {
      writeAgedFile("ip2region_v4.xdb", 7 * DAY_MS + 1_000, now);

      const summary = summarizeInventory(await readDataInventory(dataDir));

      expect(summary.ageDays).toBe(7);
      expect(summary.stale).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
