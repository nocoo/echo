import path from "node:path";
import { readFile } from "node:fs/promises";
import ip2region from "ip2region";

type IpdbType = "v4" | "v6";

export type Ip2RegionClient = {
  searchRaw: (ipaddr: string, parse?: boolean) => unknown;
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

export function resolveClientCtor() {
  const resolved = (ip2region as { default?: unknown }).default ?? ip2region;
  return resolved as new (opts: {
    ipv4db?: string;
    ipv6db?: string;
    disableIpv6?: boolean;
  }) => Ip2RegionClient;
}

type LoadClientDeps = {
  dataDirOverride?: string;
  readFileFn?: (filePath: string) => Promise<unknown>;
  createClient?: (opts: { ipv4db: string; ipv6db: string }) => Ip2RegionClient;
  constructorOverride?: new (opts: { ipv4db: string; ipv6db: string }) => Ip2RegionClient;
};

export async function loadClient(deps: LoadClientDeps = {}): Promise<Ip2RegionClient> {
  const baseDir = deps.dataDirOverride ?? dataDir;
  const v4Path = path.join(process.cwd(), baseDir, DEFAULT_FILES.v4);
  const v6Path = path.join(process.cwd(), baseDir, DEFAULT_FILES.v6);

  const read = deps.readFileFn ?? readFile;
  await read(v4Path);
  await read(v6Path);

  if (deps.createClient) {
    return deps.createClient({ ipv4db: v4Path, ipv6db: v6Path });
  }

  const Client = deps.constructorOverride ?? resolveClientCtor();
  return new Client({ ipv4db: v4Path, ipv6db: v6Path });
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
