import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AppFrame } from "../../src/app/AppFrame";
import { BasaltProviders } from "../../src/app/BasaltProviders";
import type { MeResponse } from "../../src/lib/api";
import { apiClient } from "../../src/lib/api";

const anonymous: MeResponse = { authenticated: false, email: null, name: null, picture: null };
const owner: MeResponse = {
  authenticated: true,
  email: "owner@example.com",
  name: "Owner",
  picture: null,
};

const mediaListeners = new Set<() => void>();
let mobileMatches = false;

function stubMatchMedia(): void {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return mobileMatches;
        },
        media: query,
        onchange: null,
        addEventListener: (_event: string, callback: () => void) => {
          mediaListeners.add(callback);
        },
        removeEventListener: (_event: string, callback: () => void) => {
          mediaListeners.delete(callback);
        },
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

function setViewport(mobile: boolean): void {
  mobileMatches = mobile;
  act(() => {
    for (const listener of mediaListeners) listener();
  });
}

function renderGuard(initialPath = "/keys") {
  return render(
    <MemoryRouter basename="/admin" initialEntries={[`/admin${initialPath}`]}>
      <BasaltProviders>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route element={<AppFrame />}>
            <Route path="/" element={<p>overview page</p>} />
            <Route path="/keys" element={<p>keys page</p>} />
          </Route>
        </Routes>
      </BasaltProviders>
    </MemoryRouter>,
  );
}

async function openDrawer() {
  const menu = await screen.findByRole("button", { name: "打开导航菜单" });
  await act(async () => {
    fireEvent.click(menu);
  });
  const dialog = await screen.findByRole("dialog");
  return { menu, dialog };
}

beforeEach(() => {
  mobileMatches = false;
  stubMatchMedia();
});

afterEach(() => {
  cleanup();
  mediaListeners.clear();
  mobileMatches = false;
  vi.restoreAllMocks();
  apiClient.setUnauthorizedHandler(null);
});

describe("admin login guard", () => {
  test("sends an anonymous visitor to the login page", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(anonymous);

    renderGuard();

    await waitFor(() => expect(screen.getByText("login page")).toBeTruthy());
  });

  test("sends a failed session check to the login page", async () => {
    vi.spyOn(apiClient, "me").mockRejectedValue(new Error("network down"));

    renderGuard();

    await waitFor(() => expect(screen.getByText("login page")).toBeTruthy());
  });

  test("renders the shell for a signed-in admin", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);

    renderGuard();

    await waitFor(() => expect(screen.getByText("keys page")).toBeTruthy());
    expect(screen.queryByText("login page")).toBeNull();
    expect(screen.getByText("owner@example.com")).toBeTruthy();
  });

  test("falls back to the email when the name is blank", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue({ ...owner, name: "   " });

    renderGuard();

    await waitFor(() => expect(screen.getAllByText("owner@example.com")).toHaveLength(2));
  });

  test("titles the page and shows the group trail", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);

    renderGuard("/keys");

    await waitFor(() => expect(screen.getByText("keys page")).toBeTruthy());
    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("heading", { name: "密钥" })).toBeTruthy();
    expect(header.getByText("系统")).toBeTruthy();
  });

  test("keeps the root page free of a trail", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);

    renderGuard("/");

    await waitFor(() => expect(screen.getByText("overview page")).toBeTruthy());
    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("heading", { name: "概览" })).toBeTruthy();
    expect(header.queryByText("数据")).toBeNull();
  });

  test("renders the version from the build and the outbound links", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);

    renderGuard();

    await waitFor(() => expect(screen.getByText("keys page")).toBeTruthy());
    expect(screen.getByText(`v${__ECHO_VERSION__}`)).toBeTruthy();

    const repo = screen.getByRole("link", { name: /GitHub repository/ });
    expect(repo.getAttribute("href")).toBe("https://github.com/nocoo/echo");
    expect(repo.getAttribute("target")).toBe("_blank");
    expect(repo.getAttribute("rel")).toBe("noopener noreferrer");

    const hexly = screen.getByRole("link", { name: /Echo on hexly\.ai/ });
    expect(hexly.getAttribute("href")).toBe("https://hexly.ai/projects/echo");
    expect(hexly.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("leaves the console when an admin call reports 401", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);
    const handlers: (() => void)[] = [];
    vi.spyOn(apiClient, "setUnauthorizedHandler").mockImplementation((handler) => {
      if (handler) handlers.push(handler);
    });

    renderGuard();
    await waitFor(() => expect(screen.getByText("keys page")).toBeTruthy());

    act(() => {
      for (const handler of handlers) handler();
    });

    await waitFor(() => expect(screen.getByText("login page")).toBeTruthy());
  });
});

describe("mobile drawer", () => {
  test("returns focus to the menu button after Escape", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);
    mobileMatches = true;

    renderGuard();
    const { menu, dialog } = await openDrawer();

    await act(async () => {
      fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(menu);
  });

  test("closes when the route changes", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);
    mobileMatches = true;

    renderGuard("/");
    const { dialog } = await openDrawer();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("link", { name: "密钥" }));
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("keys page")).toBeTruthy();
  });

  test("closes when the viewport leaves the mobile breakpoint", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);
    mobileMatches = true;

    renderGuard();
    await openDrawer();

    setViewport(false);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("theme toggle", () => {
  test("describes the next theme and cycles it", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);

    renderGuard();
    await waitFor(() => expect(screen.getByText("keys page")).toBeTruthy());

    const toggle = screen.getByRole("button", { name: "切换主题" });
    await act(async () => {
      fireEvent.focus(toggle);
    });

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toBe("切换为浅色主题");

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(document.documentElement.classList.contains("light")).toBe(true);
  });
});

describe("logout", () => {
  test("keeps the session when the server rejects the logout", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);
    vi.spyOn(apiClient, "logout").mockRejectedValue(new Error("network down"));

    renderGuard();
    await waitFor(() => expect(screen.getByText("keys page")).toBeTruthy());

    await act(async () => {
      screen.getByRole("button", { name: "退出登录" }).click();
    });

    await waitFor(() => expect(apiClient.logout).toHaveBeenCalledTimes(1));
    expect(screen.getByText("keys page")).toBeTruthy();
    expect(screen.queryByText("login page")).toBeNull();
  });

  test("clears the session only after the server confirms", async () => {
    vi.spyOn(apiClient, "me").mockResolvedValue(owner);
    const logout = vi.spyOn(apiClient, "logout").mockResolvedValue(undefined);

    renderGuard();
    await waitFor(() => expect(screen.getByText("keys page")).toBeTruthy());

    await act(async () => {
      screen.getByRole("button", { name: "退出登录" }).click();
    });

    await waitFor(() => expect(screen.getByText("login page")).toBeTruthy());
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
