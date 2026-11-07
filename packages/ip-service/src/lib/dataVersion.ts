import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const DATA_EXTENSIONS = [".mmdb", ".xdb"];
const DAY_MS = 24 * 60 * 60 * 1000;

export const DATA_MAX_AGE_DAYS = 7;

export interface DataAge {
  ageDays: number;
  stale: boolean;
}

export async function readDataAge(
  dataDir: string = process.env.IPDB_DIR ?? "data",
): Promise<DataAge | null> {
  const dir = path.resolve(dataDir);

  try {
    const names = await readdir(dir);
    const files = names.filter((name) => DATA_EXTENSIONS.some((ext) => name.endsWith(ext)));
    if (files.length === 0) return null;

    const times = await Promise.all(
      files.map(async (name) => (await stat(path.join(dir, name))).mtimeMs),
    );
    const ageMs = Date.now() - Math.max(...times);

    return {
      ageDays: Math.max(0, Math.floor(ageMs / DAY_MS)),
      stale: ageMs > DATA_MAX_AGE_DAYS * DAY_MS,
    };
  } catch {
    return null;
  }
}
