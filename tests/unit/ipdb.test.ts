import { beforeEach, describe, expect, test } from "bun:test";
import {
  CACHE_TTL_MS,
  getClient,
  isExpired,
  loadClient,
  refreshClient,
} from "../../src/services/ipdb";

type CacheState = {
  v4?: { client: unknown; loadedAt: number };
  v6?: { client: unknown; loadedAt: number };
};

const globalCache = globalThis as typeof globalThis & {
  __ipdbCache?: CacheState;
};

const fixedTime = 1_700_000_000_000;

function setCache(type: "v4" | "v6", loadedAt: number) {
    const entry = {
      client: { marker: type, search: async () => "" },
      loadedAt,
    };

  if (!globalCache.__ipdbCache) {
    globalCache.__ipdbCache = {};
  }

  globalCache.__ipdbCache[type] = entry;
  return entry;
}

describe("ipdb cache", () => {
  beforeEach(() => {
    globalCache.__ipdbCache = {};
  });

  test("returns cached searcher within ttl", async () => {
    const realNow = Date.now;
    Date.now = () => fixedTime;

    try {
      const entry = setCache("v4", fixedTime - 1_000);

      const client = await getClient("v4");

      expect(client).toBe(entry.client);
    } finally {
      Date.now = realNow;
    }
  });

  test("refresh keeps current within ttl", async () => {
    const now = fixedTime;
    const current = setCache("v6", now - 1_000);

    const refreshed = await refreshClient({
      type: "v6",
      current: current as unknown as { client: { search: () => Promise<string> }; loadedAt: number },
      now,
    });

    expect(refreshed).toBe(current);
  });

  test("refresh reloads after ttl", async () => {
    const now = fixedTime;
    const current = setCache("v4", now - CACHE_TTL_MS - 1_000);

    let called = false;
    const refreshed = await refreshClient({
      type: "v4",
      current: current as unknown as { client: { search: () => Promise<string> }; loadedAt: number },
      now,
      load: async () => {
        called = true;
        return { search: async () => "" };
      },
    });

    expect(called).toBe(true);
    expect(refreshed.loadedAt).toBe(now);
  });

  test("loadClient uses override and factory", async () => {
    const calls: string[] = [];
    const readFileFn = async (filePath: string) => {
      calls.push(filePath);
    };
    const created = await loadClient({
      dataDirOverride: "custom-data",
      readFileFn,
      loadContent: () => Buffer.from("IPDB"),
      createSearcher: ({ v4, v6 }: { v4: Buffer; v6: Buffer }) => {
        return {
          search: async () => `region|${v4.length}|${v6.length}|0|0`,
        };
      },
    });

    const payload = await created.search("1.1.1.1");

    expect(calls.length).toBe(2);
    expect(payload).toContain("region|");
  });

  test("loadClient uses default searcher when no factory provided", async () => {
    const readCalls: string[] = [];
    const readFileFn = async (filePath: string) => {
      readCalls.push(filePath);
    };

    const client = await loadClient({
      dataDirOverride: "default-data",
      readFileFn,
      loadContent: () => Buffer.from("IPDB"),
    });

    expect(typeof client.search).toBe("function");
    expect(readCalls.length).toBe(2);
  });



  test("isExpired returns true when ttl exceeded", () => {
    const entry = {
      client: { search: async () => "" },
      loadedAt: fixedTime - CACHE_TTL_MS - 1,
    };

    const realNow = Date.now;
    Date.now = () => fixedTime;

    try {
      expect(isExpired(entry)).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });
});
