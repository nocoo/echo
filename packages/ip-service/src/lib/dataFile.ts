import path from "node:path";

const dataDir = process.env.IPDB_DIR ?? "data";

export async function resolveDataFile(filename: string): Promise<string> {
  return path.resolve(dataDir, filename);
}
