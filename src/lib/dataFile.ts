import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const dataDir = process.env.IPDB_DIR ?? "data";
const tmpDir = "/tmp/echo-data";
const isVercel = Boolean(process.env.VERCEL);

export async function resolveDataFile(filename: string): Promise<string> {
  const rawPath = path.join(process.cwd(), dataDir, filename);

  if (!isVercel) {
    return rawPath;
  }

  const tmpPath = path.join(tmpDir, filename);
  if (existsSync(tmpPath)) {
    return tmpPath;
  }

  const gzPath = rawPath + ".gz";
  await mkdir(tmpDir, { recursive: true });
  const compressed = await readFile(gzPath);
  const decompressed = gunzipSync(compressed);
  await writeFile(tmpPath, decompressed);

  return tmpPath;
}
