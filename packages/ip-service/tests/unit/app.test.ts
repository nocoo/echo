import { describe, expect, test } from "vitest";
import { signSession } from "../../src/admin/session.js";
import { Store } from "../../src/lib/store.js";
import { createApp } from "../../src/server.js";

const auth = {
  publicOrigin: "https://echo.example.com",
  clientId: "client-id",
  clientSecret: "client-secret",
  sessionSecret: "session-secret-long-enough-for-hs256-signing",
  allowedEmails: ["owner@example.com"],
};

const lookup = async (ip: string | null) => ({
  ip: ip ?? "",
  version: 4 as const,
  location: null,
  source: "ip2region",
  attribution: ["test"],
  latencyMs: 1,
});

async function sessionCookie(): Promise<string> {
  const token = await signSession(
    { sub: "1234", email: "owner@example.com", name: "Owner", picture: null },
    auth.sessionSecret,
  );
  return `echo_session=${token}`;
}

describe("admin routes on the app", () => {
  test("requires a session", async () => {
    const app = createApp(lookup, { store: new Store(":memory:"), auth });

    const res = await app.request("/api/admin/overview");

    expect(res.status).toBe(401);
  });

  test("looks up an address for a signed-in admin", async () => {
    const app = createApp(lookup, { store: new Store(":memory:"), auth });

    const res = await app.request("/api/admin/lookup", {
      method: "POST",
      headers: {
        cookie: await sessionCookie(),
        "content-type": "application/json",
        origin: auth.publicOrigin,
      },
      body: JSON.stringify({ ip: "8.8.8.8" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ip: "8.8.8.8", source: "ip2region" });
  });

  test("reports the signed-in user", async () => {
    const app = createApp(lookup, { store: new Store(":memory:"), auth });

    const res = await app.request("/api/me", { headers: { cookie: await sessionCookie() } });

    expect(await res.json()).toMatchObject({ authenticated: true, email: "owner@example.com" });
  });
});

describe("admin error boundary", () => {
  test("answers a thrown lookup with a json error", async () => {
    const app = createApp(
      async () => {
        throw new Error("private database path");
      },
      { store: new Store(":memory:"), auth },
    );

    const res = await app.request("/api/admin/lookup", {
      method: "POST",
      headers: {
        cookie: await sessionCookie(),
        "content-type": "application/json",
        origin: auth.publicOrigin,
      },
      body: JSON.stringify({ ip: "8.8.8.8" }),
    });

    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toEqual({ error: { code: "internal_error", message: "internal error" } });
    expect(JSON.stringify(body)).not.toContain("private database path");
  });

  test("answers a thrown store error with a json error", async () => {
    const app = createApp(lookup, {
      auth,
      store: new Proxy(new Store(":memory:"), {
        get(target, property, receiver) {
          if (property === "listApiKeys") throw new Error("state directory is read only");
          return Reflect.get(target, property, receiver);
        },
      }),
    });

    const res = await app.request("/api/admin/keys", {
      headers: { cookie: await sessionCookie() },
    });

    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({
      error: { code: "internal_error", message: "internal error" },
    });
  });
});
