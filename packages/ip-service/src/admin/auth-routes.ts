import type { Context, Env, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import type { AuthConfig } from "./auth-config.js";
import { isEmailAllowed } from "./auth-config.js";
import type { GoogleProfile } from "./google-oauth.js";
import { buildAuthorizeUrl, exchangeCode, randomToken } from "./google-oauth.js";
import { isPublicOrigin } from "./origin-policy.js";
import type { SessionUser } from "./session.js";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_TTL_SECONDS,
  OAUTH_VERIFIER_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
} from "./session.js";

export interface AuthDeps {
  config: AuthConfig;
  fetchImpl?: typeof fetch;
}

export interface MeResponse {
  authenticated: boolean;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export async function readSessionUser<E extends Env>(
  c: Context<E>,
  config: AuthConfig,
): Promise<SessionUser | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;

  const user = await verifySession(token, config.sessionSecret);
  if (!user) return null;

  if (!isEmailAllowed(user.email, config.allowedEmails)) {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return null;
  }

  return user;
}

export function mePayload(user: SessionUser | null): MeResponse {
  return {
    authenticated: user !== null,
    email: user?.email ?? null,
    name: user?.name ?? null,
    picture: user?.picture ?? null,
  };
}

export function registerAuthRoutes<E extends Env>(app: Hono<E>, deps: AuthDeps): void {
  const { config } = deps;

  app.get("/api/auth/google", async (c) => {
    c.header("Cache-Control", "no-store");

    if (!config.publicOrigin || !config.clientId || !config.clientSecret) {
      return c.json({ error: "auth_not_configured" }, 503);
    }

    const state = randomToken(16);
    const verifier = randomToken(32);

    setCookie(c, OAUTH_STATE_COOKIE, state, oauthCookieOptions(config));
    setCookie(c, OAUTH_VERIFIER_COOKIE, verifier, oauthCookieOptions(config));

    return c.redirect(
      await buildAuthorizeUrl({
        clientId: config.clientId,
        origin: config.publicOrigin,
        state,
        verifier,
      }),
    );
  });

  app.get("/api/auth/callback", async (c) => {
    c.header("Cache-Control", "no-store");

    const code = c.req.query("code");
    const state = c.req.query("state");
    const expectedState = getCookie(c, OAUTH_STATE_COOKIE);
    const verifier = getCookie(c, OAUTH_VERIFIER_COOKIE);

    deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/api/auth" });
    deleteCookie(c, OAUTH_VERIFIER_COOKIE, { path: "/api/auth" });

    if (!config.publicOrigin || !code || !state || !expectedState || !verifier) {
      console.warn("[auth] callback rejected: invalid_request");
      return c.redirect("/admin/login?error=invalid_request");
    }

    if (state !== expectedState) {
      console.warn("[auth] callback rejected: state mismatch");
      return c.redirect("/admin/login?error=invalid_state");
    }

    let profile: GoogleProfile;
    try {
      profile = await exchangeCode(
        {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          origin: config.publicOrigin,
          code,
          verifier,
        },
        deps.fetchImpl,
      );
    } catch (cause) {
      console.warn(`[auth] callback rejected: ${cause instanceof Error ? cause.message : cause}`);
      return c.redirect("/admin/login?error=oauth_failed");
    }

    if (!isEmailAllowed(profile.email, config.allowedEmails)) {
      console.warn(`[auth] callback rejected: email not allowed (${profile.email})`);
      return c.redirect("/admin/login?error=access_denied");
    }

    const token = await signSession(
      {
        sub: profile.sub,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      },
      config.sessionSecret,
    );

    setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(config));

    console.info(`[auth] session issued for ${profile.email}`);
    return c.redirect("/admin");
  });

  app.post("/api/auth/logout", (c) => {
    c.header("Cache-Control", "no-store");

    if (!isPublicOrigin(c.req.header("origin"), config.publicOrigin)) {
      return c.json({ error: "forbidden" }, 403);
    }

    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  app.get("/api/me", async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(mePayload(await readSessionUser(c, config)));
  });
}

function cookieBase(config: AuthConfig): CookieOptions {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: config.publicOrigin.startsWith("https://"),
  };
}

function oauthCookieOptions(config: AuthConfig): CookieOptions {
  return { ...cookieBase(config), path: "/api/auth", maxAge: OAUTH_TTL_SECONDS };
}

function sessionCookieOptions(config: AuthConfig): CookieOptions {
  return { ...cookieBase(config), maxAge: SESSION_TTL_SECONDS };
}
