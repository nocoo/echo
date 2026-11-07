import { Hono } from "hono";
import { describe, expect, test, vi } from "vitest";
import type { AuthConfig } from "../../src/admin/auth-config.js";
import { registerAuthRoutes } from "../../src/admin/auth-routes.js";
import { signSession } from "../../src/admin/session.js";

const config: AuthConfig = {
  publicOrigin: "https://echo.example.com",
  clientId: "client-id",
  clientSecret: "client-secret",
  sessionSecret: "session-secret-long-enough-for-hs256-signing",
  allowedEmails: ["owner@example.com"],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createApp(overrides: Partial<AuthConfig> = {}, fetchImpl?: typeof fetch) {
  const app = new Hono();
  registerAuthRoutes(app, { config: { ...config, ...overrides }, fetchImpl });
  return app;
}

function googleFetch(email = "owner@example.com", verified = true): typeof fetch {
  const impl = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
    .mockResolvedValueOnce(
      jsonResponse({ sub: "1234", email, email_verified: verified, name: "Owner" }),
    );
  return impl as unknown as typeof fetch;
}

describe("GET /api/auth/google", () => {
  test("reports missing configuration", async () => {
    const app = createApp({ publicOrigin: "", clientId: "", clientSecret: "" });
    const res = await app.request("/api/auth/google");

    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "auth_not_configured" });
  });

  test("redirects to google with pkce cookies", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/google");

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("https://accounts.google.com/o/oauth2/v2/auth")).toBe(true);

    const cookies = res.headers.getSetCookie();
    expect(cookies.length).toBe(2);
    expect(cookies.some((cookie) => cookie.startsWith("echo_oauth_state="))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith("echo_oauth_verifier="))).toBe(true);
    expect(cookies.every((cookie) => cookie.includes("HttpOnly"))).toBe(true);
    expect(cookies.every((cookie) => cookie.includes("Path=/api/auth"))).toBe(true);
    expect(cookies.every((cookie) => cookie.includes("Secure"))).toBe(true);
  });

  test("drops the secure flag over plain http", async () => {
    const app = createApp({ publicOrigin: "http://localhost:7010" });
    const res = await app.request("/api/auth/google");

    expect(res.headers.getSetCookie().every((cookie) => !cookie.includes("Secure"))).toBe(true);
  });
});

describe("GET /api/auth/callback", () => {
  test("rejects a callback without state cookies", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/callback?code=auth-code&state=state-value");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin/login?error=invalid_request");
  });

  test("rejects a mismatched state and consumes the cookies", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/callback?code=auth-code&state=other", {
      headers: { cookie: "echo_oauth_state=state-value; echo_oauth_verifier=verifier-value" },
    });

    expect(res.headers.get("location")).toBe("/admin/login?error=invalid_state");
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((cookie) => cookie.startsWith("echo_oauth_state="))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith("echo_oauth_verifier="))).toBe(true);
  });

  test("rejects a callback without a code", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/callback?state=state-value", {
      headers: { cookie: "echo_oauth_state=state-value; echo_oauth_verifier=verifier-value" },
    });

    expect(res.headers.get("location")).toBe("/admin/login?error=invalid_request");
  });

  test("reports a failed token exchange", async () => {
    const app = createApp({}, vi.fn().mockResolvedValue(jsonResponse({}, 500)) as never);
    const res = await app.request("/api/auth/callback?code=auth-code&state=state-value", {
      headers: { cookie: "echo_oauth_state=state-value; echo_oauth_verifier=verifier-value" },
    });

    expect(res.headers.get("location")).toBe("/admin/login?error=oauth_failed");
  });

  test("rejects an address outside the allow list", async () => {
    const app = createApp({}, googleFetch("other@example.com"));
    const res = await app.request("/api/auth/callback?code=auth-code&state=state-value", {
      headers: { cookie: "echo_oauth_state=state-value; echo_oauth_verifier=verifier-value" },
    });

    expect(res.headers.get("location")).toBe("/admin/login?error=access_denied");
  });

  test("rejects an unverified address", async () => {
    const app = createApp({}, googleFetch("owner@example.com", false));
    const res = await app.request("/api/auth/callback?code=auth-code&state=state-value", {
      headers: { cookie: "echo_oauth_state=state-value; echo_oauth_verifier=verifier-value" },
    });

    expect(res.headers.get("location")).toBe("/admin/login?error=oauth_failed");
  });

  test("issues a session cookie", async () => {
    const app = createApp({}, googleFetch());
    const res = await app.request("/api/auth/callback?code=auth-code&state=state-value", {
      headers: { cookie: "echo_oauth_state=state-value; echo_oauth_verifier=verifier-value" },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin");
    expect(res.headers.get("cache-control")).toBe("no-store");

    const session = res.headers.getSetCookie().find((cookie) => cookie.startsWith("echo_session="));
    expect(session).toBeDefined();
    expect(session).toContain("HttpOnly");
    expect(session).toContain("SameSite=Lax");
  });
});

describe("POST /api/auth/logout", () => {
  test("rejects a missing origin", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/logout", { method: "POST" });

    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("rejects a foreign origin", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://evil.example.com" },
    });

    expect(res.status).toBe(403);
  });

  test("clears the session", async () => {
    const app = createApp();
    const res = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://echo.example.com" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.getSetCookie().some((cookie) => cookie.startsWith("echo_session="))).toBe(
      true,
    );
  });
});

describe("GET /api/me", () => {
  test("reports an anonymous visitor", async () => {
    const app = createApp();
    const res = await app.request("/api/me");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      authenticated: false,
      email: null,
      name: null,
      picture: null,
    });
  });

  test("reports the signed-in user", async () => {
    const app = createApp();
    const token = await signSession(
      { sub: "1234", email: "owner@example.com", name: "Owner", picture: null },
      config.sessionSecret,
    );

    const res = await app.request("/api/me", { headers: { cookie: `echo_session=${token}` } });

    expect(await res.json()).toEqual({
      authenticated: true,
      email: "owner@example.com",
      name: "Owner",
      picture: null,
    });
  });

  test("ignores a forged session cookie", async () => {
    const app = createApp();
    const res = await app.request("/api/me", { headers: { cookie: "echo_session=forged" } });

    expect(await res.json()).toMatchObject({ authenticated: false });
  });
});
