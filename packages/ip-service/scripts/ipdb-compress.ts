import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const dataDir = process.env.IPDB_DIR ?? "data";
const dirPath = path.resolve(dataDir);

const files = await readdir(dirPath);
const dataFiles = files.filter(
  (f) => f.endsWith(".mmdb") || f.endsWith(".xdb"),
);

console.log(`Compressing ${dataFiles.length} files in ${dataDir}/\n`);

for (const file of dataFiles) {
  const filePath = path.join(dirPath, file);
  const raw = await readFile(filePath);
  const compressed = gzipSync(raw, { level: 9 });
  const ratio = ((compressed.byteLength / raw.byteLength) * 100).toFixed(1);
  await writeFile(filePath + ".gz", compressed);
  await unlink(filePath);
  console.log(
    `  ${file}: ${(raw.byteLength / 1024 / 1024).toFixed(1)} MB → ${(compressed.byteLength / 1024 / 1024).toFixed(1)} MB (${ratio}%)`,
  );
}

console.log("\n✓ Done. Original files removed, .gz files ready for deploy.");
