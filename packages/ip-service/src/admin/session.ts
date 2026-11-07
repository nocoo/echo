import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "echo_session";
export const OAUTH_STATE_COOKIE = "echo_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "echo_oauth_verifier";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const OAUTH_TTL_SECONDS = 600;

export interface SessionUser {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser, secret: string): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    picture: user.picture,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionUser | null> {
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: ["HS256"] });
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!email || typeof payload.sub !== "string") return null;

    return {
      sub: payload.sub,
      email,
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    return null;
  }
}
