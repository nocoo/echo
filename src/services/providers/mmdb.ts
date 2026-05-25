import maxmind, { type Reader } from "maxmind";
import type { Response } from "mmdb-lib";

const readers = new Map<string, Reader<Response>>();

export async function openMmdb(filepath: string): Promise<Reader<Response>> {
  const cached = readers.get(filepath);
  if (cached) return cached;
  const reader = await maxmind.open<Response>(filepath);
  readers.set(filepath, reader);
  return reader;
}

export function resetMmdbCache(): void {
  readers.clear();
}
