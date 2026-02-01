import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  IPv4,
  IPv6,
  loadContentFromFile,
  newWithBuffer,
  type Searcher,
} from "ip2region.js";

type IpdbType = "v4" | "v6";

export type Ip2RegionClient = {
  search: (ip: string) => Promise<string>;
  getIOCount?: () => number;
  close?: () => void;
};

export type CacheEntry = {
  client: Ip2RegionClient;
  loadedAt: number;
};

export type CacheState = {
  v4?: CacheEntry;
  v6?: CacheEntry;
};

export const CACHE_TTL_MS = 60 * 60 * 1000;

const DEFAULT_FILES: Record<IpdbType, string> = {
  v4: "ip2region_v4.xdb",
  v6: "ip2region_v6.xdb",
};

const dataDir = process.env.IPDB_DIR ?? "data";

export const globalCache = globalThis as typeof globalThis & {
  __ipdbCache?: CacheState;
};

export function now() {
  return Date.now();
}

export function isExpired(entry: CacheEntry) {
  return now() - entry.loadedAt > CACHE_TTL_MS;
}

type LoadClientDeps = {
  dataDirOverride?: string;
  readFileFn?: (filePath: string) => Promise<unknown>;
  loadContent?: (filePath: string) => Buffer;
  createSearcher?: (opts: { v4: Buffer; v6: Buffer }) => Ip2RegionClient;
  createSearchers?: () => { v4: Searcher; v6: Searcher };
};

export async function loadClient(deps: LoadClientDeps = {}): Promise<Ip2RegionClient> {
  const baseDir = deps.dataDirOverride ?? dataDir;
  const v4Path = path.join(process.cwd(), baseDir, DEFAULT_FILES.v4);
  const v6Path = path.join(process.cwd(), baseDir, DEFAULT_FILES.v6);

  const read = deps.readFileFn ?? readFile;
  await read(v4Path);
  await read(v6Path);

  const load = deps.loadContent ?? loadContentFromFile;
  const v4Buffer = load(v4Path);
  const v6Buffer = load(v6Path);

  if (deps.createSearcher) {
    return deps.createSearcher({ v4: v4Buffer, v6: v6Buffer });
  }

  const created = deps.createSearchers?.();
  const v4Searcher = created?.v4 ?? newWithBuffer(IPv4, v4Buffer);
  const v6Searcher = created?.v6 ?? newWithBuffer(IPv6, v6Buffer);

  return {
    search: async (ip: string) => {
      const searcher = pickSearcher(ip, v4Searcher, v6Searcher);
      return searcher.search(ip);
    },
    getIOCount: () => 0,
    close: () => undefined,
  } satisfies Ip2RegionClient;
}

export function isIpv6(ip: string) {
  return ip.includes(":");
}

export function pickSearcher(ip: string, v4Searcher: Searcher, v6Searcher: Searcher) {
  return isIpv6(ip) ? v6Searcher : v4Searcher;
}

export type CacheRefresh = {
  type: IpdbType;
  current: CacheEntry | undefined;
  now: number;
  load?: () => Promise<Ip2RegionClient>;
};

export async function refreshClient({ current, now, load }: CacheRefresh) {
  if (current && now - current.loadedAt <= CACHE_TTL_MS) {
    return current;
  }

  const nextClient = await (load ?? loadClient)();
  return { client: nextClient, loadedAt: now } satisfies CacheEntry;
}

export async function getClient(type: IpdbType): Promise<Ip2RegionClient> {
  if (!globalCache.__ipdbCache) {
    globalCache.__ipdbCache = {};
  }

  const entry = globalCache.__ipdbCache[type];
  const loaded = await refreshClient({ type, current: entry, now: now() });
  globalCache.__ipdbCache[type] = loaded;
  return loaded.client;
}
