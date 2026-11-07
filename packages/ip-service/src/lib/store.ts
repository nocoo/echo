import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type ApiKeyStatus = "active" | "revoked";
export type RefreshRunStatus = "requested" | "running" | "ok" | "error";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  status: ApiKeyStatus;
  created_by: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

export interface RefreshRun {
  id: string;
  requested_by: string;
  requested_at: number;
  status: RefreshRunStatus;
  finished_at: number | null;
  detail: string | null;
}

export interface CreatedApiKey {
  apiKey: ApiKey;
  secret: string;
}

const KEY_PREFIX = "echo_";
const LAST_USED_WRITE_INTERVAL_MS = 60_000;

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active','revoked')),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS refresh_runs (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','running','ok','error')),
  finished_at INTEGER,
  detail TEXT
);
`;

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function defaultStateDir(): string {
  return path.resolve(process.env.STATE_DIR ?? "state");
}

export function defaultStorePath(): string {
  return path.join(defaultStateDir(), "echo.db");
}

export class Store {
  private readonly db: DatabaseSync;

  constructor(filePath: string) {
    if (filePath !== ":memory:") {
      mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    }
    this.db = new DatabaseSync(filePath);
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  listApiKeys(): ApiKey[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, key_prefix, status, created_by, created_at, last_used_at, revoked_at
         FROM api_keys ORDER BY created_at DESC, id`,
      )
      .all();
    return rows.map((row) => toApiKey(row as Record<string, unknown>));
  }

  createApiKey(name: string, createdBy: string): CreatedApiKey {
    const secret = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
    const createdAt = Date.now();
    const apiKey: ApiKey = {
      id: randomUUID(),
      name,
      key_prefix: secret.slice(0, 12),
      status: "active",
      created_by: createdBy,
      created_at: createdAt,
      last_used_at: null,
      revoked_at: null,
    };

    this.db
      .prepare(
        `INSERT INTO api_keys
           (id, name, key_prefix, key_hash, status, created_by, created_at, last_used_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        apiKey.id,
        apiKey.name,
        apiKey.key_prefix,
        hashApiKey(secret),
        apiKey.status,
        apiKey.created_by,
        apiKey.created_at,
        null,
        null,
      );

    return { apiKey, secret };
  }

  findApiKeyBySecret(secret: string): ApiKey | null {
    const row = this.db
      .prepare(
        `SELECT id, name, key_prefix, status, created_by, created_at, last_used_at, revoked_at
         FROM api_keys WHERE key_hash = ?`,
      )
      .get(hashApiKey(secret));

    if (!row) return null;

    const apiKey = toApiKey(row as Record<string, unknown>);
    if (apiKey.status !== "active") return null;

    const now = Date.now();
    if (apiKey.last_used_at === null || now - apiKey.last_used_at > LAST_USED_WRITE_INTERVAL_MS) {
      this.db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(now, apiKey.id);
      apiKey.last_used_at = now;
    }

    return apiKey;
  }

  revokeApiKey(id: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE api_keys SET status = 'revoked', revoked_at = COALESCE(revoked_at, ?)
         WHERE id = ? AND status = 'active'`,
      )
      .run(Date.now(), id);
    return result.changes > 0;
  }

  listRefreshRuns(limit = 20): RefreshRun[] {
    const rows = this.db
      .prepare(
        `SELECT id, requested_by, requested_at, status, finished_at, detail
         FROM refresh_runs ORDER BY requested_at DESC, id LIMIT ?`,
      )
      .all(limit);
    return rows.map((row) => toRefreshRun(row as Record<string, unknown>));
  }

  latestRefreshRun(): RefreshRun | null {
    const runs = this.listRefreshRuns(1);
    return runs[0] ?? null;
  }

  createRefreshRun(requestedBy: string): RefreshRun {
    const run: RefreshRun = {
      id: randomUUID(),
      requested_by: requestedBy,
      requested_at: Date.now(),
      status: "requested",
      finished_at: null,
      detail: null,
    };

    this.db
      .prepare(
        `INSERT INTO refresh_runs (id, requested_by, requested_at, status, finished_at, detail)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(run.id, run.requested_by, run.requested_at, run.status, run.finished_at, run.detail);

    return run;
  }

  updateRefreshRun(
    id: string,
    status: RefreshRunStatus,
    detail: string | null = null,
    finished: boolean = false,
  ): boolean {
    const result = this.db
      .prepare(`UPDATE refresh_runs SET status = ?, detail = ?, finished_at = ? WHERE id = ?`)
      .run(status, detail, finished ? Date.now() : null, id);
    return result.changes > 0;
  }
}

function toApiKey(row: Record<string, unknown>): ApiKey {
  return {
    id: String(row.id),
    name: String(row.name),
    key_prefix: String(row.key_prefix),
    status: row.status === "revoked" ? "revoked" : "active",
    created_by: String(row.created_by),
    created_at: Number(row.created_at),
    last_used_at: row.last_used_at === null ? null : Number(row.last_used_at),
    revoked_at: row.revoked_at === null ? null : Number(row.revoked_at),
  };
}

function toRefreshRun(row: Record<string, unknown>): RefreshRun {
  const status = row.status;
  return {
    id: String(row.id),
    requested_by: String(row.requested_by),
    requested_at: Number(row.requested_at),
    status: status === "running" || status === "ok" || status === "error" ? status : "requested",
    finished_at: row.finished_at === null ? null : Number(row.finished_at),
    detail: row.detail === null ? null : String(row.detail),
  };
}
