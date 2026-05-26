import maxmind, { type Reader } from "maxmind";
import type { Response } from "mmdb-lib";
import { resolveDataFile } from "../../lib/dataFile.js";

const readers = new Map<string, Reader<Response>>();

export async function openMmdb(filename: string): Promise<Reader<Response>> {
  const cached = readers.get(filename);
  if (cached) return cached;
  const filepath = await resolveDataFile(filename);
  const reader = await maxmind.open<Response>(filepath);
  readers.set(filename, reader);
  return reader;
}

export function resetMmdbCache(): void {
  readers.clear();
}
