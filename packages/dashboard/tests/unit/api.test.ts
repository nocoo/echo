import { describe, expect, test, vi } from "vitest";
import { ApiClient, ApiError, createApiClient, describeError } from "../../src/lib/api";

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function stubFetch(
  responses: Response[],
  calls: Call[] = [],
): { fetchImpl: typeof fetch; calls: Call[] } {
  let index = 0;
  const fetchImpl = ((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const response = responses[index];
    index += 1;
    if (!response) throw new Error("no stubbed response left");
    return Promise.resolve(response);
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("api client", () => {
  test("reads the current session", async () => {
    const { fetchImpl, calls } = stubFetch([
      json({ authenticated: true, email: "owner@example.com", name: "Owner", picture: null }),
    ]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.me()).resolves.toEqual({
      authenticated: true,
      email: "owner@example.com",
      name: "Owner",
      picture: null,
    });
    expect(calls[0]?.url).toBe("/api/me");
    expect(calls[0]?.init?.credentials).toBe("same-origin");
  });

  test("reads the overview", async () => {
    const { fetchImpl } = stubFetch([
      json({ databases: [], summary: { present: 0, missing: 0, ageDays: null, stale: false } }),
    ]);
    const client = new ApiClient({ fetchImpl });

    const overview = await client.overview();
    expect(overview.summary.present).toBe(0);
  });

  test("posts a lookup request", async () => {
    const { fetchImpl, calls } = stubFetch([
      json({ ip: "8.8.8.8", version: 4, location: null, source: "ip2region", attribution: [] }),
    ]);
    const client = new ApiClient({ fetchImpl });

    await client.lookup("8.8.8.8");

    expect(calls[0]?.url).toBe("/api/admin/lookup");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ ip: "8.8.8.8" }));
    expect(new Headers(calls[0]?.init?.headers).get("content-type")).toBe("application/json");
  });

  test("lists keys", async () => {
    const { fetchImpl } = stubFetch([json({ keys: [{ id: "1" }] })]);
    const client = new ApiClient({ fetchImpl });

    const keys = await client.listKeys();
    expect(keys).toHaveLength(1);
  });

  test("creates a key", async () => {
    const { fetchImpl, calls } = stubFetch([
      json({ apiKey: { id: "1" }, secret: "echo_secret" }, 201),
    ]);
    const client = new ApiClient({ fetchImpl });

    const created = await client.createKey("ci");
    expect(created.secret).toBe("echo_secret");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ name: "ci" }));
  });

  test("revokes a key", async () => {
    const { fetchImpl, calls } = stubFetch([json({ ok: true, id: "1" })]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.revokeKey("1")).resolves.toBeUndefined();
    expect(calls[0]?.url).toBe("/api/admin/keys/1/revoke");
    expect(calls[0]?.init?.method).toBe("POST");
  });

  test("reads the refresh status", async () => {
    const { fetchImpl } = stubFetch([json({ current: null })]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.refreshStatus()).resolves.toEqual({ current: null });
  });

  test("signs out", async () => {
    const { fetchImpl, calls } = stubFetch([json({ ok: true })]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.logout()).resolves.toBeUndefined();
    expect(calls[0]?.url).toBe("/api/auth/logout");
    expect(calls[0]?.init?.method).toBe("POST");
  });

  test("prefixes the base url", async () => {
    const { fetchImpl, calls } = stubFetch([json({ current: null })]);
    const client = new ApiClient({ fetchImpl, baseUrl: "http://127.0.0.1:7010" });

    await client.refreshStatus();
    expect(calls[0]?.url).toBe("http://127.0.0.1:7010/api/admin/refresh");
  });

  test("raises the server error message", async () => {
    const { fetchImpl } = stubFetch([
      json({ error: { code: "invalid_ip", message: "invalid ip" } }, 400),
    ]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.lookup("nope")).rejects.toThrowError(
      expect.objectContaining({ message: "invalid ip", status: 400, code: "invalid_ip" }),
    );
  });

  test("handles an error payload that is not an object", async () => {
    const { fetchImpl } = stubFetch([json("plain failure", 502)]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.me()).rejects.toThrowError(
      expect.objectContaining({ message: "request failed with status 502", code: null }),
    );
  });

  test("handles an error field that is not an object", async () => {
    const { fetchImpl } = stubFetch([json({ error: "boom" }, 500)]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.me()).rejects.toThrowError(
      expect.objectContaining({ message: "request failed with status 500", code: null }),
    );
  });

  test("handles non-string error fields", async () => {
    const { fetchImpl } = stubFetch([json({ error: { code: 42, message: null } }, 418)]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.me()).rejects.toThrowError(
      expect.objectContaining({ message: "request failed with status 418", code: null }),
    );
  });

  test("falls back to a generic message", async () => {
    const { fetchImpl } = stubFetch([new Response("boom", { status: 500 })]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.me()).rejects.toThrowError(
      expect.objectContaining({ message: "request failed with status 500" }),
    );
  });

  test("ignores an empty success body", async () => {
    const { fetchImpl } = stubFetch([new Response(null, { status: 204 })]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.me()).resolves.toBeNull();
  });

  test("survives a broken success body", async () => {
    const { fetchImpl } = stubFetch([new Response("not json", { status: 200 })]);
    const client = new ApiClient({ fetchImpl });

    await expect(client.me()).resolves.toBeNull();
  });

  test("creates a client with defaults", () => {
    expect(createApiClient()).toBeInstanceOf(ApiClient);
  });

  test("notifies the unauthorized handler on 401", async () => {
    const { fetchImpl } = stubFetch([json({ error: "unauthorized" }, 401)]);
    const client = new ApiClient({ fetchImpl });
    const handler = vi.fn();
    client.setUnauthorizedHandler(handler);

    await expect(client.listKeys()).rejects.toThrowError(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("stops notifying once the handler is cleared", async () => {
    const { fetchImpl } = stubFetch([json({ error: "unauthorized" }, 401)]);
    const client = new ApiClient({ fetchImpl });
    const handler = vi.fn();
    client.setUnauthorizedHandler(handler);
    client.setUnauthorizedHandler(null);

    await expect(client.listKeys()).rejects.toThrowError(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("default fetch binding", () => {
  test("survives a browser-style fetch that rejects a non-global this", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(
        Response.json({ authenticated: false, email: null, name: null, picture: null }),
      );
    } as typeof fetch;

    try {
      const client = new ApiClient();
      await expect(client.me()).resolves.toMatchObject({ authenticated: false });
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("describeError", () => {
  test("prefers the api error message", () => {
    expect(describeError(new ApiError("boom", 500, "x"))).toBe("boom");
  });

  test("uses the error message of other errors", () => {
    expect(describeError(new Error("other"))).toBe("other");
  });

  test("falls back to a generic message", () => {
    expect(describeError("string")).toBe("请求失败");
  });
});
