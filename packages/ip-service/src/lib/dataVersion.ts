import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const DATA_EXTENSIONS = [".mmdb", ".xdb"];

export async function readDataRefreshedAt(
  dataDir: string = process.env.IPDB_DIR ?? "data",
): Promise<string | null> {
  const dir = path.resolve(dataDir);

  try {
    const names = await readdir(dir);
    const files = names.filter((name) => DATA_EXTENSIONS.some((ext) => name.endsWith(ext)));
    if (files.length === 0) return null;

    const times = await Promise.all(
      files.map(async (name) => (await stat(path.join(dir, name))).mtimeMs),
    );
    return new Date(Math.max(...times)).toISOString();
  } catch {
    return null;
  }
}
