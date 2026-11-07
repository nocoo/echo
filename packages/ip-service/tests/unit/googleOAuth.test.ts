import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import {
  buildAuthorizeUrl,
  callbackUrl,
  exchangeCode,
  pkceChallenge,
  randomToken,
} from "../../src/admin/google-oauth.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("random tokens", () => {
  test("produces url-safe random values", () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toBe(randomToken());
  });

  test("honours the requested size", () => {
    expect(randomToken(16)).toHaveLength(22);
  });
});

describe("pkce", () => {
  test("derives the S256 challenge from the verifier", async () => {
    const verifier = "a-very-long-code-verifier-value";
    const expected = createHash("sha256").update(verifier).digest("base64url");

    expect(await pkceChallenge(verifier)).toBe(expected);
  });
});

describe("callback url", () => {
  test("derives the callback from the public origin", () => {
    expect(callbackUrl("https://echo.example.com")).toBe(
      "https://echo.example.com/api/auth/callback",
    );
    expect(callbackUrl("https://echo.example.com/")).toBe(
      "https://echo.example.com/api/auth/callback",
    );
  });
});

describe("authorize url", () => {
  test("carries the pkce challenge and state", async () => {
    const url = new URL(
      await buildAuthorizeUrl({
        clientId: "client-id",
        origin: "https://echo.example.com",
        state: "state-value",
        verifier: "verifier-value",
      }),
    );

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://echo.example.com/api/auth/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(await pkceChallenge("verifier-value"));
  });
});

describe("exchange code", () => {
  const input = {
    clientId: "client-id",
    clientSecret: "client-secret",
    origin: "https://echo.example.com",
    code: "auth-code",
    verifier: "verifier-value",
  };

  test("returns the google profile", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          sub: "1234",
          email: "owner@example.com",
          email_verified: true,
          name: "Owner",
          picture: "https://img",
        }),
      );

    const profile = await exchangeCode(input, fetchImpl as unknown as typeof fetch);

    expect(profile).toEqual({
      sub: "1234",
      email: "owner@example.com",
      emailVerified: true,
      name: "Owner",
      picture: "https://img",
    });

    const tokenCall = fetchImpl.mock.calls[0];
    expect(String(tokenCall?.[0])).toBe("https://oauth2.googleapis.com/token");
    const body = tokenCall?.[1]?.body as URLSearchParams;
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("code_verifier")).toBe("verifier-value");
    expect(body.get("redirect_uri")).toBe("https://echo.example.com/api/auth/callback");
  });

  test("fills optional profile fields", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(
        jsonResponse({ sub: "1234", email: "owner@example.com", email_verified: true }),
      );

    const profile = await exchangeCode(input, fetchImpl as unknown as typeof fetch);

    expect(profile.name).toBeNull();
    expect(profile.picture).toBeNull();
    expect(profile.emailVerified).toBe(true);
  });

  test("fails when the token exchange is rejected", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({ error: "invalid_grant" }, 400));

    await expect(exchangeCode(input, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      "invalid_grant",
    );
  });

  test("fails when the token response has no access token", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({}, 200));

    await expect(exchangeCode(input, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      "google token http 200",
    );
  });

  test("fails when the token response is not json", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response("not json", { status: 200 }));

    await expect(exchangeCode(input, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      "google token http 200",
    );
  });

  test("fails when the profile request is rejected", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({}, 401));

    await expect(exchangeCode(input, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      "google userinfo http 401",
    );
  });

  test("fails when the profile has no email", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(jsonResponse({ sub: "1234", email_verified: true }));

    await expect(exchangeCode(input, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      "google userinfo is missing sub or email",
    );
  });

  test("fails when sub or email is not a string", async () => {
    for (const profile of [
      { sub: 1234, email: "owner@example.com", email_verified: true },
      { sub: "1234", email: 42, email_verified: true },
    ]) {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
        .mockResolvedValueOnce(jsonResponse(profile));

      await expect(exchangeCode(input, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
        "google userinfo is missing sub or email",
      );
    }
  });

  test("requires a strictly verified email", async () => {
    for (const value of [undefined, false, "true", 1]) {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
        .mockResolvedValueOnce(
          jsonResponse({ sub: "1234", email: "owner@example.com", email_verified: value }),
        );

      await expect(exchangeCode(input, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
        "google email is not verified",
      );
    }
  });

  test("fails when the profile is not json", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(new Response("not json", { status: 200 }));

    await expect(exchangeCode(input, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      "google userinfo is missing sub or email",
    );
  });

  test("fails when the email is not verified", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(
        jsonResponse({ sub: "1234", email: "owner@example.com", email_verified: false }),
      );

    await expect(exchangeCode(input, fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      "google email is not verified",
    );
  });
});
