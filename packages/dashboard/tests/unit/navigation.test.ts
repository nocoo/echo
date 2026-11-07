import { describe, expect, test } from "vitest";
import {
  isActivePath,
  NAV_GROUPS,
  NAV_ITEMS,
  resolvePageContext,
  userInitials,
} from "../../src/lib/navigation";

describe("navigation model", () => {
  test("groups every destination once", () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual(["数据", "系统"]);
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(["/", "/lookup", "/tools", "/keys"]);
    expect(NAV_GROUPS.flatMap((group) => group.items)).toHaveLength(NAV_ITEMS.length);
  });

  test("marks the active destination", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/keys", "/")).toBe(false);
    expect(isActivePath("/keys", "/keys")).toBe(true);
    expect(isActivePath("/keys/abc", "/keys")).toBe(true);
    expect(isActivePath("/lookup", "/lookup")).toBe(true);
    expect(isActivePath("/lookup2", "/lookup")).toBe(false);
  });
});

describe("resolvePageContext", () => {
  test("gives the root page a title and no trail", () => {
    expect(resolvePageContext("/")).toEqual({
      title: "概览",
      breadcrumbs: [],
      documentTitle: "概览 · Echo",
    });
  });

  test("adds the group as the ancestor trail", () => {
    expect(resolvePageContext("/lookup")).toEqual({
      title: "查询",
      breadcrumbs: [{ label: "数据" }],
      documentTitle: "查询 · Echo",
    });
    expect(resolvePageContext("/tools").breadcrumbs).toEqual([{ label: "数据" }]);
    expect(resolvePageContext("/keys").breadcrumbs).toEqual([{ label: "系统" }]);
  });

  test("keeps the trail on nested paths", () => {
    expect(resolvePageContext("/keys/abc")).toEqual({
      title: "密钥",
      breadcrumbs: [{ label: "系统" }],
      documentTitle: "密钥 · Echo",
    });
  });

  test("titles the login page", () => {
    expect(resolvePageContext("/login")).toEqual({
      title: "登录",
      breadcrumbs: [],
      documentTitle: "登录 · Echo",
    });
  });

  test("falls back for an unknown path", () => {
    expect(resolvePageContext("/nope")).toEqual({
      title: "管理台",
      breadcrumbs: [],
      documentTitle: "管理台 · Echo",
    });
  });
});

describe("userInitials", () => {
  test("prefers the name", () => {
    expect(userInitials("owner", "owner@example.com")).toBe("O");
  });

  test("falls back to the email", () => {
    expect(userInitials(null, "owner@example.com")).toBe("O");
    expect(userInitials("   ", "owner@example.com")).toBe("O");
  });

  test("falls back to a placeholder", () => {
    expect(userInitials(null, null)).toBe("?");
  });
});
