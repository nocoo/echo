interface Env {
  ECHO: KVNamespace;
}

interface ReportPayload {
  ip: string;
  query: string;
}

const KV_TTL = 300;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "POST" && path.startsWith("/report/")) {
      return handleReport(request, env, path);
    }

    if (request.method === "GET" && path.startsWith("/result/")) {
      return handleResult(env, path);
    }

    if (request.method === "GET" && path === "/health") {
      return Response.json({ status: "ok", kv: "connected" });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleReport(request: Request, env: Env, path: string): Promise<Response> {
  const token = path.slice("/report/".length);
  if (!token) {
    return new Response("Bad Request", { status: 400 });
  }

  const body = await request.json<ReportPayload>();
  if (!body.ip) {
    return new Response("Bad Request", { status: 400 });
  }

  const key = `dns:${token}`;
  const existing = await env.ECHO.get(key);
  const servers: string[] = existing ? JSON.parse(existing) : [];

  if (!servers.includes(body.ip)) {
    servers.push(body.ip);
  }

  await env.ECHO.put(key, JSON.stringify(servers), { expirationTtl: KV_TTL });

  return new Response(null, { status: 204 });
}

async function handleResult(env: Env, path: string): Promise<Response> {
  const token = path.slice("/result/".length);
  if (!token) {
    return new Response("Bad Request", { status: 400 });
  }

  const key = `dns:${token}`;
  const data = await env.ECHO.get(key);
  const servers: string[] = data ? JSON.parse(data) : [];

  return Response.json({
    token,
    dns_servers: servers,
    count: servers.length,
  });
}
