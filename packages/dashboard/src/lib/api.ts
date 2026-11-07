export interface MeResponse {
  authenticated: boolean;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export interface IpLocation {
  country: string;
  countryCode: string;
  province: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  isp: string;
  asn: number | null;
  asOrg: string;
}

export interface ProviderResult {
  name: string;
  attribution: string;
  location: IpLocation | null;
  latencyMs: number;
  error: boolean;
}

export type DatabaseStatus = "missing" | "ok" | "stale";

export interface DatabaseEntry {
  filename: string;
  provider: string;
  url: string;
  present: boolean;
  size: number | null;
  modifiedAt: string | null;
  ageDays: number | null;
  buildDate: string | null;
  status: DatabaseStatus;
}

export interface OverviewSummary {
  present: number;
  missing: number;
  ageDays: number | null;
  stale: boolean;
}

export interface OverviewResponse {
  databases: DatabaseEntry[];
  summary: OverviewSummary;
}

export interface LookupResponse {
  ip: string;
  version: 4 | 6;
  location: IpLocation | null;
  source: string;
  attribution: string[];
  latencyMs: number;
  providers?: ProviderResult[];
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  status: "active" | "revoked";
  created_by: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

export interface CreatedApiKey {
  apiKey: ApiKey;
  secret: string;
}

export interface RefreshRun {
  id: string;
  requested_by: string;
  requested_at: number;
  status: "requested" | "running" | "ok" | "error";
  finished_at: number | null;
  detail: string | null;
}

export interface RefreshStatus {
  current: RefreshRun | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private unauthorizedHandler: (() => void) | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  setUnauthorizedHandler(handler: (() => void) | null): void {
    this.unauthorizedHandler = handler;
  }

  me(): Promise<MeResponse> {
    return this.request<MeResponse>("/api/me");
  }

  overview(): Promise<OverviewResponse> {
    return this.request<OverviewResponse>("/api/admin/overview");
  }

  lookup(ip: string): Promise<LookupResponse> {
    return this.request<LookupResponse>("/api/admin/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ip }),
    });
  }

  listKeys(): Promise<ApiKey[]> {
    return this.request<{ keys: ApiKey[] }>("/api/admin/keys").then((body) => body.keys);
  }

  createKey(name: string): Promise<CreatedApiKey> {
    return this.request<CreatedApiKey>("/api/admin/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  revokeKey(id: string): Promise<void> {
    return this.request<{ ok: boolean; id: string }>(`/api/admin/keys/${id}/revoke`, {
      method: "POST",
    }).then(() => undefined);
  }

  refreshStatus(): Promise<RefreshStatus> {
    return this.request<RefreshStatus>("/api/admin/refresh");
  }

  logout(): Promise<void> {
    return this.request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }).then(
      () => undefined,
    );
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      credentials: "same-origin",
      ...init,
      headers: { accept: "application/json", ...init.headers },
    });

    const text = await res.text();
    const payload = text.length > 0 ? parseJson(text) : null;

    if (res.status === 401) {
      this.unauthorizedHandler?.();
    }

    if (!res.ok) {
      const error = readError(payload);
      throw new ApiError(
        error?.message ?? `request failed with status ${res.status}`,
        res.status,
        error?.code ?? null,
      );
    }

    return payload as T;
  }
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return new ApiClient(options);
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "请求失败";
}

export const apiClient = createApiClient();

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readError(payload: unknown): { code: string | null; message: string | null } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const record = error as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === "string" ? record.code : null,
    message: typeof record.message === "string" ? record.message : null,
  };
}
