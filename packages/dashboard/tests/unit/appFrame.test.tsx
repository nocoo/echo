import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";
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

afterEach(() => {
  cleanup();
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

    const repo = screen.getByRole("link", { name: /GitHub 仓库/ });
    expect(repo.getAttribute("href")).toBe("https://github.com/nocoo/echo");
    expect(repo.getAttribute("target")).toBe("_blank");
    expect(repo.getAttribute("rel")).toBe("noopener noreferrer");

    const hexly = screen.getByRole("link", { name: /hexly\.ai/ });
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
