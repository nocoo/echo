import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface DashboardAsset {
  body: ArrayBuffer;
  contentType: string;
}

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function defaultDashboardDir(): string {
  return path.resolve(import.meta.dirname, "../../../dashboard/dist");
}

export function resolveDashboardDir(dir?: string): string {
  const configured = dir ?? process.env.DASHBOARD_DIR;
  return configured ? path.resolve(configured) : defaultDashboardDir();
}

export function isSpaRoute(pathname: string): boolean {
  if (pathname === "/admin") return true;
  if (!pathname.startsWith("/admin/")) return false;
  const rest = pathname.slice("/admin/".length);
  return rest.length > 0 && !rest.includes(".");
}

export async function readDashboardIndex(dir: string): Promise<DashboardAsset | null> {
  return readAsset(path.join(dir, "index.html"));
}

export async function readDashboardAsset(
  dir: string,
  relativePath: string,
): Promise<DashboardAsset | null> {
  const root = path.resolve(dir);
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(`${root}${path.sep}`)) return null;
  return readAsset(target);
}

async function readAsset(filePath: string): Promise<DashboardAsset | null> {
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return null;
    const buffer = await readFile(filePath);
    const body = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    return { body, contentType: contentTypeFor(filePath) };
  } catch {
    return null;
  }
}

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
