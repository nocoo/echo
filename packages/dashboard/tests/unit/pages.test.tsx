import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BasaltProviders } from "../../src/app/BasaltProviders";
import KeysPage from "../../src/app/keys/KeysPage";
import LookupPage from "../../src/app/lookup/LookupPage";
import OverviewPage from "../../src/app/overview/OverviewPage";
import ToolsPage from "../../src/app/tools/ToolsPage";
import { apiClient } from "../../src/lib/api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage(node: React.ReactNode) {
  return render(
    <MemoryRouter basename="/admin" initialEntries={["/admin"]}>
      <BasaltProviders>{node}</BasaltProviders>
    </MemoryRouter>,
  );
}

describe("overview page", () => {
  test("shows the stat cards and the database cards", async () => {
    vi.spyOn(apiClient, "overview").mockResolvedValue({
      databases: [
        {
          filename: "ip2region_v4.xdb",
          provider: "ip2region",
          url: "https://example.com",
          present: true,
          size: 1024,
          modifiedAt: "2026-01-02T03:04:05.000Z",
          ageDays: 1,
          buildDate: null,
          status: "ok",
        },
        {
          filename: "missing.mmdb",
          provider: "circl",
          url: "https://example.com",
          present: false,
          size: null,
          modifiedAt: null,
          ageDays: null,
          buildDate: null,
          status: "missing",
        },
      ],
      summary: { present: 1, missing: 1, ageDays: 1, stale: false },
    });
    vi.spyOn(apiClient, "listKeys").mockResolvedValue([
      {
        id: "key-1",
        name: "ci",
        key_prefix: "echo_abcdefgh",
        status: "active",
        created_by: "owner@example.com",
        created_at: 1,
        last_used_at: null,
        revoked_at: null,
      },
    ]);

    renderPage(<OverviewPage />);

    await waitFor(() => expect(screen.getByText("ip2region_v4.xdb")).toBeTruthy());
    expect(screen.getAllByText("数据年龄").length).toBeGreaterThan(0);
    expect(screen.getAllByText("总大小").length).toBeGreaterThan(0);
    expect(screen.getAllByText("有效 key").length).toBeGreaterThan(0);
    expect(screen.getByText("missing.mmdb")).toBeTruthy();
    expect(screen.getByText("缺失")).toBeTruthy();
  });
});

describe("lookup page", () => {
  test("offers examples before a query", async () => {
    renderPage(<LookupPage />);

    expect(screen.getByText("还没有查询结果")).toBeTruthy();
    expect(screen.getByRole("button", { name: "8.8.8.8" })).toBeTruthy();
  });

  test("renders the hero and the provider cards", async () => {
    vi.spyOn(apiClient, "lookup").mockResolvedValue({
      ip: "8.8.8.8",
      version: 4,
      location: {
        country: "美国",
        countryCode: "US",
        province: "加利福尼亚",
        city: "山景城",
        latitude: null,
        longitude: null,
        isp: "Google",
        asn: 15169,
        asOrg: "Google LLC",
      },
      source: "ip2region",
      attribution: ["ip2region"],
      latencyMs: 12,
      providers: [
        {
          name: "ip2region",
          attribution: "test",
          location: null,
          latencyMs: 12,
          error: false,
        },
      ],
    });

    renderPage(<LookupPage />);

    fireEvent.change(screen.getByLabelText("目标地址"), { target: { value: "8.8.8.8" } });
    fireEvent.click(screen.getByRole("button", { name: "查询" }));

    await waitFor(() => expect(screen.getByText("8.8.8.8")).toBeTruthy());
    expect(screen.getByText("美国 · 加利福尼亚 · 山景城")).toBeTruthy();
    expect(screen.getByText("Google LLC")).toBeTruthy();
    expect(screen.getByText("ip2region")).toBeTruthy();
  });
});

describe("tools page", () => {
  test("shows the network cards for a cidr", async () => {
    renderPage(<ToolsPage />);

    fireEvent.change(screen.getByLabelText("地址或 CIDR"), {
      target: { value: "192.168.1.130/24" },
    });

    await waitFor(() => expect(screen.getByText("192.168.1.0")).toBeTruthy());
    expect(screen.getByText("广播地址")).toBeTruthy();
    expect(screen.getByText("可用主机")).toBeTruthy();
  });
});

describe("tools prefix table", () => {
  test("marks the active prefix row without relying on colour", async () => {
    renderPage(<ToolsPage />);

    fireEvent.change(screen.getByLabelText("地址或 CIDR"), {
      target: { value: "192.168.1.130/24" },
    });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "前缀表" }), { button: 0 });

    await waitFor(() =>
      expect(screen.getByText("每个前缀下的网络地址、广播地址与可用主机数")).toBeTruthy(),
    );

    const marker = screen.getByText("当前前缀");
    const row = marker.closest("tr");
    expect(row?.getAttribute("aria-selected")).toBe("true");
    expect(row?.getAttribute("aria-current")).toBe("true");
  });
});

describe("keys page", () => {
  test("shows the empty state", async () => {
    vi.spyOn(apiClient, "listKeys").mockResolvedValue([]);

    renderPage(<KeysPage />);

    await waitFor(() =>
      expect(screen.getByText("还没有 API key，新建一个即可查询指定地址。")).toBeTruthy(),
    );
  });

  test("shows a key with its status", async () => {
    vi.spyOn(apiClient, "listKeys").mockResolvedValue([
      {
        id: "key-1",
        name: "ci",
        key_prefix: "echo_abcdefgh",
        status: "active",
        created_by: "owner@example.com",
        created_at: 1,
        last_used_at: null,
        revoked_at: null,
      },
    ]);

    renderPage(<KeysPage />);

    await waitFor(() => expect(screen.getByText("echo_abcdefgh")).toBeTruthy());
    expect(screen.getByText("有效")).toBeTruthy();
  });
});
