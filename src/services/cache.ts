import { LRUCache } from "lru-cache";
import type { IpLocation } from "./ipProvider.js";

export type ProviderResult = {
  name: string;
  attribution: string;
  location: IpLocation | null;
  latencyMs: number;
};

export type CachedLookup = {
  results: ProviderResult[];
};

export const CACHE_MAX = 100;
export const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new LRUCache<string, CachedLookup>({ max: CACHE_MAX, ttl: CACHE_TTL_MS });

export function getCached(ip: string): CachedLookup | undefined {
  return cache.get(ip);
}

export function setCached(ip: string, value: CachedLookup): void {
  cache.set(ip, value);
}

export function resetCache(): void {
  cache.clear();
}

export function cacheSize(): number {
  return cache.size;
}

export function getRemainingTTL(ip: string): number {
  return cache.getRemainingTTL(ip);
}
