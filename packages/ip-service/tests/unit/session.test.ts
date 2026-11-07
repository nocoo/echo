import { SignJWT } from "jose";
import { describe, expect, test } from "vitest";
import { signSession, verifySession } from "../../src/admin/session.js";

const secret = "session-secret-long-enough-for-hs256-signing";

describe("session tokens", () => {
  test("round-trips a user", async () => {
    const token = await signSession(
      { sub: "1234", email: "owner@example.com", name: "Owner", picture: "https://img" },
      secret,
    );

    const user = await verifySession(token, secret);
    expect(user).toEqual({
      sub: "1234",
      email: "owner@example.com",
      name: "Owner",
      picture: "https://img",
    });
  });

  test("keeps optional fields empty", async () => {
    const token = await signSession(
      { sub: "1234", email: "owner@example.com", name: null, picture: null },
      secret,
    );

    const user = await verifySession(token, secret);
    expect(user?.name).toBeNull();
    expect(user?.picture).toBeNull();
  });

  test("rejects a token signed with another secret", async () => {
    const token = await signSession(
      { sub: "1234", email: "owner@example.com", name: null, picture: null },
      secret,
    );

    expect(await verifySession(token, "another-secret-long-enough-for-hs256")).toBeNull();
  });

  test("rejects malformed tokens", async () => {
    expect(await verifySession("not-a-token", secret)).toBeNull();
  });

  test("rejects everything when no session secret is configured", async () => {
    const token = await signSession(
      { sub: "1234", email: "owner@example.com", name: null, picture: null },
      secret,
    );

    expect(await verifySession(token, "")).toBeNull();
  });

  test("rejects tokens without an email or subject", async () => {
    const key = new TextEncoder().encode(secret);
    const withoutEmail = await new SignJWT({ name: "Owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1234")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);
    const withoutSubject = await new SignJWT({ email: "owner@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);

    expect(await verifySession(withoutEmail, secret)).toBeNull();
    expect(await verifySession(withoutSubject, secret)).toBeNull();
  });
});
