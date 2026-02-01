import { Hono } from "hono";
import { extractClientIp } from "./utils/ip";
import { lookupIp, type LookupResult } from "./services/ipLookup";

type LookupFn = (ip: string | null) => Promise<LookupResult | null>;

const attribution =
  "IP2Region data provided by https://ip2region.net (Apache-2.0).";

export function createApp(lookup: LookupFn = lookupIp) {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ status: "ok" });
  });

  app.get("/api/ip", async (c) => {
    const started = performance.now();
    const rawIp = extractClientIp(c.req.raw.headers);

    try {
      const result = await lookup(rawIp);
      const latencyMs = Math.round(performance.now() - started);

      if (!result) {
        return c.json(
          {
            error: { code: "invalid_ip", message: "invalid ip" },
            ip: rawIp,
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
          ip: rawIp,
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
