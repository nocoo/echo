import type { Hono } from "hono";
import { readDataInventory, summarizeInventory } from "../lib/dataInventory.js";
import type { Store } from "../lib/store.js";
import type { LookupResult } from "../services/ipLookup.js";
import { extractClientIp } from "../utils/ip.js";
import type { AuthConfig } from "./auth-config.js";
import { readSessionUser } from "./auth-routes.js";
import { isPublicOrigin } from "./origin-policy.js";
import type { SessionUser } from "./session.js";

export interface AdminEnv {
  Variables: {
    user: SessionUser;
  };
}

export interface AdminDeps {
  config: AuthConfig;
  store: () => Store;
  lookup: (ip: string, detail: boolean) => Promise<LookupResult | null>;
  dataDir?: string;
}

export function registerAdminRoutes(app: Hono<AdminEnv>, deps: AdminDeps): void {
  const { config } = deps;

  app.use("/api/admin/*", async (c, next) => {
    const user = await readSessionUser(c, config);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    c.set("user", user);
    await next();
  });

  app.get("/api/admin/overview", async (c) => {
    const databases = await readDataInventory(deps.dataDir);
    return c.json({ databases, summary: summarizeInventory(databases) });
  });

  app.post("/api/admin/lookup", async (c) => {
    if (!isPublicOrigin(c.req.header("origin"), config.publicOrigin)) {
      return c.json({ error: "forbidden" }, 403);
    }

    const body = await c.req.json().catch(() => null);
    const requested = typeof body?.ip === "string" ? body.ip.trim() : "";
    const ip = requested || extractClientIp(c.req.raw.headers);
    if (!ip) {
      return c.json({ error: { code: "invalid_request", message: "ip is required" } }, 400);
    }

    const result = await deps.lookup(ip, true);
    if (!result) {
      return c.json({ error: { code: "invalid_ip", message: "invalid ip" } }, 400);
    }

    return c.json(result);
  });

  app.get("/api/admin/keys", (c) => {
    return c.json({ keys: deps.store().listApiKeys() });
  });

  app.post("/api/admin/keys", async (c) => {
    if (!isPublicOrigin(c.req.header("origin"), config.publicOrigin)) {
      return c.json({ error: "forbidden" }, 403);
    }

    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return c.json({ error: { code: "invalid_request", message: "name is required" } }, 400);
    }

    const created = deps.store().createApiKey(name, c.get("user").email);
    return c.json({ apiKey: created.apiKey, secret: created.secret }, 201);
  });

  app.post("/api/admin/keys/:id/revoke", (c) => {
    if (!isPublicOrigin(c.req.header("origin"), config.publicOrigin)) {
      return c.json({ error: "forbidden" }, 403);
    }

    const id = c.req.param("id");
    if (!deps.store().revokeApiKey(id)) {
      return c.json({ error: { code: "not_found", message: "api key not found" } }, 404);
    }

    return c.json({ ok: true, id });
  });

  app.get("/api/admin/refresh", (c) => {
    return c.json({ current: deps.store().latestRefreshRun() });
  });
}
