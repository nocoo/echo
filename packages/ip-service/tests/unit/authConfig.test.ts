import { afterEach, describe, expect, test } from "vitest";
import { isEmailAllowed, readAuthConfig } from "../../src/admin/auth-config.js";

const touched: string[] = [];

function setEnv(key: string, value: string): void {
  touched.push(key);
  process.env[key] = value;
}

afterEach(() => {
  for (const key of touched.splice(0)) delete process.env[key];
});

describe("readAuthConfig", () => {
  test("reads and normalises the environment", () => {
    const config = readAuthConfig({
      PUBLIC_ORIGIN: "https://echo.example.com/",
      GOOGLE_CLIENT_ID: " client-id ",
      GOOGLE_CLIENT_SECRET: "client-secret",
      SESSION_SECRET: "session-secret",
      ALLOWED_EMAILS: "Owner@Example.com, second@example.com , ",
    });

    expect(config.publicOrigin).toBe("https://echo.example.com");
    expect(config.clientId).toBe("client-id");
    expect(config.clientSecret).toBe("client-secret");
    expect(config.sessionSecret).toBe("session-secret");
    expect(config.allowedEmails).toEqual(["owner@example.com", "second@example.com"]);
  });

  test("defaults every field when nothing is configured", () => {
    const config = readAuthConfig({});

    expect(config.publicOrigin).toBe("");
    expect(config.clientId).toBe("");
    expect(config.clientSecret).toBe("");
    expect(config.sessionSecret).toBe("");
    expect(config.allowedEmails).toEqual([]);
  });

  test("falls back to the process environment", () => {
    setEnv("PUBLIC_ORIGIN", "http://localhost:7010");
    setEnv("ALLOWED_EMAILS", "owner@example.com");

    const config = readAuthConfig();
    expect(config.publicOrigin).toBe("http://localhost:7010");
    expect(config.allowedEmails).toEqual(["owner@example.com"]);
  });
});

describe("isEmailAllowed", () => {
  test("fails closed when the allow list is empty", () => {
    expect(isEmailAllowed("owner@example.com", [])).toBe(false);
  });

  test("matches case-insensitively", () => {
    expect(isEmailAllowed("Owner@Example.com", ["owner@example.com"])).toBe(true);
    expect(isEmailAllowed("owner@example.com ", ["owner@example.com"])).toBe(true);
  });

  test("rejects unknown addresses", () => {
    expect(isEmailAllowed("other@example.com", ["owner@example.com"])).toBe(false);
  });
});
