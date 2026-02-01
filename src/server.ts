import { Hono } from "hono";
import { extractClientIp } from "./utils/ip";
import { lookupIp } from "./services/ipLookup";

const app = new Hono();

const attribution =
  "IP2Region data provided by https://ip2region.net (Apache-2.0).";

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/api/ip", async (c) => {
  const started = performance.now();
  const rawIp = extractClientIp(c.req.raw.headers);
  const result = await lookupIp(rawIp);
  const latencyMs = Math.round(performance.now() - started);

  if (!result) {
    return c.json(
      {
        error: "invalid ip",
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
});

export default app;
