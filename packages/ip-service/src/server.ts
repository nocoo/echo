import { Hono } from "hono";
import { extractClientIp } from "./utils/ip.js";
import { lookupIp, type LookupResult } from "./services/ipLookup.js";
import { version } from "./lib/version.js";

type LookupFn = (ip: string | null, detail?: boolean) => Promise<LookupResult | null>;

const bootedAt = Date.now();

export function createApp(
  lookup: LookupFn = lookupIp,
  apiKey: string | undefined = process.env.ECHO_API_KEY,
) {
  const app = new Hono();

  app.get("/api/live", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({
      status: "ok",
      version,
      component: "echo",
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - bootedAt) / 1000),
    });
  });

  app.get("/", (c) => {
    return c.json({
      name: "echo",
      status: "ok",
      endpoints: ["/api/live", "/api/ip"],
      docs: "README.md",
    });
  });

  app.get("/api/ip", async (c) => {
    const started = performance.now();

    const queryIp = c.req.query("ip") ?? null;
    const detail = c.req.query("detail") === "true";
    const headerKey = c.req.header("x-api-key") ?? null;
    const authenticated = Boolean(apiKey && headerKey === apiKey);

    const targetIp =
      authenticated && queryIp ? queryIp : extractClientIp(c.req.raw.headers);

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

  return app;
}

const app = createApp();

export default app;
