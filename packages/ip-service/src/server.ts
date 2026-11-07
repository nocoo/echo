import path from "node:path";
import type { Context } from "hono";
import { Hono } from "hono";
import { type AdminEnv, registerAdminRoutes } from "./admin/admin-routes.js";
import { type AuthConfig, readAuthConfig } from "./admin/auth-config.js";
import { registerAuthRoutes } from "./admin/auth-routes.js";
import {
  isSpaRoute,
  readDashboardAsset,
  readDashboardIndex,
  resolveDashboardDir,
} from "./lib/dashboard.js";
import { type DataAge, readDataAge } from "./lib/dataVersion.js";
import { defaultStorePath, Store } from "./lib/store.js";
import { version } from "./lib/version.js";
import { type LookupResult, lookupIp } from "./services/ipLookup.js";
import { extractClientIp } from "./utils/ip.js";

type LookupFn = (ip: string | null, detail?: boolean) => Promise<LookupResult | null>;
type DataAgeFn = () => Promise<DataAge | null>;

export interface AppOptions {
  dataAge?: DataAgeFn;
  store?: Store;
  auth?: AuthConfig;
  fetchImpl?: typeof fetch;
  dataDir?: string;
  dashboardDir?: string;
}

const bootedAt = Date.now();

function isValidApiKey(secret: string, resolveStore: () => Store): boolean {
  try {
    return resolveStore().findApiKeyBySecret(secret) !== null;
  } catch {
    return false;
  }
}

export function createApp(lookup: LookupFn = lookupIp, options: AppOptions = {}) {
  const app = new Hono<AdminEnv>();
  const dataAge = options.dataAge ?? readDataAge;
  const auth = options.auth ?? readAuthConfig();

  let fallbackStore: Store | undefined;
  const resolveStore = (): Store => {
    if (options.store) return options.store;
    fallbackStore ??= new Store(defaultStorePath());
    return fallbackStore;
  };

  registerAuthRoutes(app, { config: auth, fetchImpl: options.fetchImpl });
  registerAdminRoutes(app, {
    config: auth,
    store: resolveStore,
    lookup: (ip, detail) => lookup(ip, detail),
    dataDir: options.dataDir,
  });

  app.get("/api/live", async (c) => {
    c.header("Cache-Control", "no-store");

    let connected = false;
    try {
      connected = (await lookup("1.1.1.1")) !== null;
    } catch {
      connected = false;
    }

    const age = await dataAge();
    const status = !connected || !age ? "error" : age.stale ? "outdated" : "ok";

    return c.json(
      {
        status,
        version,
        component: "echo",
        timestamp: new Date().toISOString(),
        uptime: Math.round((Date.now() - bootedAt) / 1000),
        database: { connected, ageDays: age?.ageDays ?? null },
      },
      status === "ok" ? 200 : 503,
    );
  });

  app.get("/", (c) => {
    return c.json({
      name: "echo",
      status: "ok",
      endpoints: ["/api/live", "/api/ip"],
      docs: "README.md",
    });
  });

  const dashboardDir = resolveDashboardDir(options.dashboardDir);

  app.get("/admin/assets/*", async (c) => {
    const relative = c.req.path.slice("/admin/assets/".length);
    const asset = await readDashboardAsset(path.join(dashboardDir, "assets"), relative);
    if (!asset) return c.notFound();
    return c.body(asset.body, 200, {
      "content-type": asset.contentType,
      "cache-control": "public, max-age=31536000, immutable",
    });
  });

  app.get("/admin", async (c) => {
    return serveDashboardIndex(c, dashboardDir);
  });

  app.get("/admin/*", async (c) => {
    if (!isSpaRoute(c.req.path)) return c.notFound();
    return serveDashboardIndex(c, dashboardDir);
  });

  app.get("/api/ip", async (c) => {
    const started = performance.now();

    const queryIp = c.req.query("ip") ?? null;
    const detail = c.req.query("detail") === "true";
    const headerKey = c.req.header("x-api-key") ?? null;
    const authenticated = headerKey !== null && isValidApiKey(headerKey, resolveStore);

    const targetIp = authenticated && queryIp ? queryIp : extractClientIp(c.req.raw.headers);

    try {
      const result = await lookup(targetIp, detail);
      const latencyMs = Math.round(performance.now() - started);

      if (!result) {
        return c.json(
          {
            error: { code: "invalid_ip", message: "invalid ip" },
            ip: targetIp,
            latencyMs,
          },
          400,
        );
      }

      const response: Record<string, unknown> = {
        ip: result.ip,
        version: result.version,
        location: result.location,
        latencyMs,
        source: result.source,
        attribution: result.attribution,
      };

      if (result.providers) {
        response.providers = result.providers;
      }

      return c.json(response);
    } catch {
      const latencyMs = Math.round(performance.now() - started);
      return c.json(
        {
          error: { code: "lookup_failed", message: "lookup failed" },
          ip: targetIp,
          latencyMs,
        },
        500,
      );
    }
  });

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: { code: "not_found", message: "not found" } }, 404);
    }
    return c.text("404 Not Found", 404);
  });

  return app;
}

async function serveDashboardIndex(c: Context, dashboardDir: string) {
  const index = await readDashboardIndex(dashboardDir);
  if (!index) return c.notFound();
  return c.body(index.body, 200, {
    "content-type": index.contentType,
    "cache-control": "no-cache",
  });
}

const app = createApp();

export default app;
