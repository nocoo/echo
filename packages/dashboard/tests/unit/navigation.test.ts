import { describe, expect, test } from "vitest";
import {
  isActivePath,
  NAV_GROUPS,
  NAV_ITEMS,
  normalizePath,
  pageVariant,
  resolveDisplayUser,
  resolvePageContext,
  userInitials,
} from "../../src/lib/navigation";

describe("navigation model", () => {
  test("groups every destination once", () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual(["数据", "系统"]);
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(["/", "/lookup", "/tools", "/keys"]);
    expect(NAV_GROUPS.flatMap((group) => group.items)).toHaveLength(NAV_ITEMS.length);
  });

  test("normalizes trailing slashes and case", () => {
    expect(normalizePath("/keys/")).toBe("/keys");
    expect(normalizePath("/KEYS")).toBe("/keys");
    expect(normalizePath(" /keys// ")).toBe("/keys");
    expect(normalizePath("")).toBe("/");
    expect(normalizePath("/")).toBe("/");
  });

  test("marks only the destination the router renders", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/keys", "/")).toBe(false);
    expect(isActivePath("/keys", "/keys")).toBe(true);
    expect(isActivePath("/keys/", "/keys")).toBe(true);
    expect(isActivePath("/LOOKUP", "/lookup")).toBe(true);
    expect(isActivePath("/keys/unknown", "/keys")).toBe(false);
    expect(isActivePath("/lookup2", "/lookup")).toBe(false);
  });

  test("maps paths to page variants", () => {
    expect(pageVariant("/")).toBe("overview");
    expect(pageVariant("/LOOKUP/")).toBe("lookup");
    expect(pageVariant("/tools")).toBe("tools");
    expect(pageVariant("/keys")).toBe("keys");
    expect(pageVariant("/login")).toBe("default");
    expect(pageVariant("/keys/unknown")).toBe("default");
  });
});

describe("resolvePageContext", () => {
  test("gives the root page a title and no trail", () => {
    expect(resolvePageContext("/")).toEqual({
      title: "概览",
      breadcrumbs: [],
      documentTitle: "概览 · Echo",
      variant: "overview",
    });
  });

  test("adds the group as the ancestor trail", () => {
    expect(resolvePageContext("/lookup")).toEqual({
      title: "查询",
      breadcrumbs: [{ label: "数据" }],
      documentTitle: "查询 · Echo",
      variant: "lookup",
    });
    expect(resolvePageContext("/tools").breadcrumbs).toEqual([{ label: "数据" }]);
    expect(resolvePageContext("/keys").breadcrumbs).toEqual([{ label: "系统" }]);
  });

  test("normalizes the trailing slash", () => {
    expect(resolvePageContext("/keys/")).toEqual({
      title: "密钥",
      breadcrumbs: [{ label: "系统" }],
      documentTitle: "密钥 · Echo",
      variant: "keys",
    });
  });

  test("does not claim an unknown nested path", () => {
    expect(resolvePageContext("/keys/unknown")).toEqual({
      title: "管理台",
      breadcrumbs: [],
      documentTitle: "管理台 · Echo",
      variant: "default",
    });
  });

  test("titles the login page", () => {
    expect(resolvePageContext("/login")).toEqual({
      title: "登录",
      breadcrumbs: [],
      documentTitle: "登录 · Echo",
      variant: "default",
    });
  });

  test("falls back for an unknown path", () => {
    expect(resolvePageContext("/nope")).toEqual({
      title: "管理台",
      breadcrumbs: [],
      documentTitle: "管理台 · Echo",
      variant: "default",
    });
  });
});

describe("resolveDisplayUser", () => {
  test("prefers the name and derives initials from it", () => {
    expect(resolveDisplayUser("Owner", "owner@example.com")).toEqual({
      label: "Owner",
      initials: "O",
    });
  });

  test("falls back to the email when the name is blank", () => {
    expect(resolveDisplayUser("   ", "owner@example.com")).toEqual({
      label: "owner@example.com",
      initials: "O",
    });
    expect(resolveDisplayUser(null, " owner@example.com ")).toEqual({
      label: "owner@example.com",
      initials: "O",
    });
  });

  test("shares one fallback between the label and the initials", () => {
    expect(resolveDisplayUser(null, null)).toEqual({ label: "已登录", initials: "已" });
    expect(resolveDisplayUser("", "")).toEqual({ label: "已登录", initials: "已" });
    expect(resolveDisplayUser(null, null, "Viewer")).toEqual({
      label: "Viewer",
      initials: "V",
    });
  });

  test("derives initials by grapheme, not UTF-16 unit", () => {
    expect(resolveDisplayUser("𠮷田", null).initials).toBe("𠮷");
    expect(resolveDisplayUser("👨‍👩‍👧 family", null).initials).toBe("👨‍👩‍👧");
    expect(resolveDisplayUser(null, null, "élodie").initials).toBe("É");
  });
});

describe("userInitials", () => {
  test("returns a placeholder for an empty source", () => {
    expect(userInitials("")).toBe("?");
    expect(userInitials("   ")).toBe("?");
  });

  test("uppercases the first grapheme", () => {
    expect(userInitials("owner")).toBe("O");
    expect(userInitials("  zoe")).toBe("Z");
  });
});
