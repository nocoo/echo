import { expect, type Locator, test } from "@playwright/test";

const identity = {
  authenticated: true,
  name: "Sidebar Fixture",
  email: "sidebar@example.test",
  picture: null,
};

async function geometry(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, y: rect.y };
  });
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    throw new Error(`Unexpected browser fixture request: ${route.request().url()}`);
  });
  await page.route("**/api/me", (route) => route.fulfill({ json: identity }));
  await page.route("**/api/admin/lookup", (route) =>
    route.fulfill({
      json: {
        ip: "127.0.0.1",
        version: 4,
        location: null,
        source: "",
        attribution: [],
        latencyMs: 0,
      },
    }),
  );
  await page.route("**/api/admin/keys", (route) => route.fulfill({ json: { keys: [] } }));
  await page.route("**/api/admin/overview", (route) =>
    route.fulfill({
      json: {
        databases: [],
        summary: { present: 0, missing: 0, ageDays: null, stale: false },
      },
    }),
  );
  await page.route("**/api/auth/logout", (route) => route.fulfill({ json: { ok: true } }));
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`desktop avatar stays stationary in ${colorScheme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/admin/tools");
    const sidebar = page.locator("[data-basalt-sidebar]");
    const avatar = sidebar.locator(".h-basalt-9");
    const brand = sidebar.locator('[data-slot="sidebar-brand-copy"]');
    await expect(brand).toBeVisible();
    await expect(sidebar).toHaveCSS("width", "260px");
    await expect(avatar).toHaveCSS("width", "36px");
    await expect(avatar).toHaveCSS("height", "36px");
    await expect(sidebar.getByText(identity.email, { exact: true })).toHaveCSS(
      "line-height",
      "16px",
    );
    const expanded = await geometry(avatar);
    await sidebar.getByRole("button", { name: "收起侧边栏", exact: true }).click();
    await page.mouse.move(1000, 400);
    await expect(sidebar).toHaveAttribute("data-collapsed", "");
    await expect(sidebar).toHaveCSS("width", "68px");
    await expect(brand).toBeHidden();
    const collapsed = await geometry(avatar);
    expect(collapsed).toEqual(expanded);
    await sidebar.getByRole("link", { name: "查询", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/lookup$/);
    await sidebar.getByRole("button", { name: "展开侧边栏", exact: true }).click();
    await page.mouse.move(1000, 400);
    await expect(sidebar).toHaveCSS("width", "260px");
    await expect(brand).toBeVisible();
    await sidebar.getByRole("button", { name: "退出登录", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  for (const width of [390, 700]) {
    test(`mobile drawer geometry, focus and routing at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/admin/tools");
      const menu = page.getByRole("button", {
        name: "打开导航菜单",
        exact: true,
        includeHidden: true,
      });
      const drawer = page.locator('[data-slot="sidebar-drawer"]');
      await expect(page.locator("[data-basalt-sidebar]")).toHaveCount(0);
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await menu.focus();
      await page.keyboard.press("Enter");
      await expect(drawer).toBeVisible();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await expect(drawer).toHaveAttribute("id", (await menu.getAttribute("aria-controls")) ?? "");
      await expect(drawer).toHaveCSS("width", "320px");
      await expect(drawer).toHaveCSS("padding-left", "0px");
      await expect(drawer).toHaveCSS("padding-right", "0px");
      await expect(drawer.locator("[data-basalt-sidebar]")).toHaveCSS("width", "260px");
      await expect(drawer.locator(".h-basalt-9")).toHaveCSS("width", "36px");
      await expect(drawer.locator(".h-basalt-9")).toHaveCSS("height", "36px");
      const dismiss = drawer.getByRole("button", { name: "关闭导航菜单", exact: true });
      await dismiss.focus();
      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      await expect(menu).toBeFocused();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await menu.click();
      await drawer.getByRole("link", { name: "查询", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/lookup$/);
      await expect(drawer).toHaveCount(0);
      await expect(menu).toBeFocused();
      await menu.click();
      await drawer.getByRole("button", { name: "关闭导航菜单", exact: true }).click();
      await expect(drawer).toHaveCount(0);
      await expect(menu).toBeFocused();
      await page.setViewportSize({ width: 1280, height: 844 });
      await expect(page.locator("[data-basalt-sidebar]")).not.toHaveAttribute("data-collapsed");
      await expect(page.locator("[data-basalt-sidebar]")).toHaveCSS("width", "260px");
    });
  }
}
