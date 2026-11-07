import { describe, expect, test } from "vitest";
import { isPublicOrigin } from "../../src/admin/origin-policy.js";

describe("isPublicOrigin", () => {
  test("accepts an exact match", () => {
    expect(isPublicOrigin("https://echo.example.com", "https://echo.example.com")).toBe(true);
  });

  test("rejects a missing origin", () => {
    expect(isPublicOrigin(undefined, "https://echo.example.com")).toBe(false);
    expect(isPublicOrigin(null, "https://echo.example.com")).toBe(false);
    expect(isPublicOrigin("", "https://echo.example.com")).toBe(false);
  });

  test("rejects a different origin", () => {
    expect(isPublicOrigin("https://evil.example.com", "https://echo.example.com")).toBe(false);
    expect(isPublicOrigin("http://echo.example.com", "https://echo.example.com")).toBe(false);
  });

  test("rejects everything when no public origin is configured", () => {
    expect(isPublicOrigin("https://echo.example.com", "")).toBe(false);
  });
});
