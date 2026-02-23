import { Hono } from "hono";
import { extractClientIp } from "./utils/ip.js";
import { lookupIp, type LookupResult } from "./services/ipLookup.js";
import pkg from "../package.json";

type LookupFn = (ip: string | null) => Promise<LookupResult | null>;

const attribution =
  "IP2Region data provided by https://ip2region.net (Apache-2.0).";

export function createApp(
  lookup: LookupFn = lookupIp,
  apiKey: string | undefined = process.env.ECHO_API_KEY,
) {
  const app = new Hono();

  app.get("/api/live", (c) => {
    return c.json({ status: "ok", version: `v${pkg.version}` });
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
    const headerKey = c.req.header("x-api-key") ?? null;
    const authenticated = Boolean(apiKey && headerKey === apiKey);

    // Use query IP only when authenticated; silently fall back to source IP
    const targetIp =
      authenticated && queryIp ? queryIp : extractClientIp(c.req.raw.headers);

    try {
      const result = await lookup(targetIp);
      const latencyMs = Math.round(performance.now() - started);

      if (!result) {
        return c.json(
          {
            error: { code: "invalid_ip", message: "invalid ip" },
            ip: targetIp,
            source: "ip2region",
            attribution,
            latencyMs,
          },
          400,
        );
      }

      return c.json({
        ip: result.ip,
        version: result.version,
        location: result.location,
        latencyMs,
        source: "ip2region",
        attribution,
      });
    } catch {
      const latencyMs = Math.round(performance.now() - started);
      return c.json(
        {
          error: { code: "lookup_failed", message: "lookup failed" },
          ip: targetIp,
          source: "ip2region",
          attribution,
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
