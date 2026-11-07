import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Flag } from "../../src/components/visual/Flag";
import { LatencyDots } from "../../src/components/visual/LatencyDots";
import { MetaBadge } from "../../src/components/visual/MetaBadge";
import { MonoIp } from "../../src/components/visual/MonoIp";
import { ProviderCard } from "../../src/components/visual/ProviderCard";
import type { ProviderResult } from "../../src/lib/api";

afterEach(() => {
  cleanup();
});

function provider(overrides: Partial<ProviderResult> = {}): ProviderResult {
  return {
    name: "ip2region",
    attribution: "test",
    location: {
      country: "中国",
      countryCode: "CN",
      province: "北京",
      city: "大兴",
      latitude: null,
      longitude: null,
      isp: "移动",
      asn: 9808,
      asOrg: "China Mobile",
    },
    latencyMs: 12,
    error: false,
    ...overrides,
  };
}

describe("Flag", () => {
  test("renders the regional indicator and falls back", () => {
    const { container } = render(<Flag countryCode="US" />);
    expect(container.textContent).toBe("🇺🇸");

    cleanup();
    const fallback = render(<Flag countryCode={null} />);
    expect(fallback.container.textContent).toBe("🌐");
  });
});

describe("MonoIp", () => {
  test("truncates in the middle when asked", () => {
    render(
      <MonoIp value="2a0b:9900:0000:0000:0000:0000:0000:ec0b" variant="middle" maxLength={14} />,
    );
    expect(screen.getByText("2a0b:9900…ec0b")).toBeTruthy();
  });
});

describe("LatencyDots", () => {
  test("fills the scale for a fast lookup", () => {
    const { container } = render(<LatencyDots latencyMs={4} />);

    expect(screen.getByText("4ms")).toBeTruthy();
    expect(container.querySelectorAll(".bg-basalt-success")).toHaveLength(10);
  });

  test("scales down for a slow lookup", () => {
    const { container } = render(<LatencyDots latencyMs={200} tone="muted" />);

    expect(screen.getByText("200ms")).toBeTruthy();
    expect(container.querySelectorAll(".bg-basalt-muted-foreground")).toHaveLength(1);
  });

  test("shows a muted dash without a scale for an unknown latency", () => {
    const { container } = render(<LatencyDots latencyMs={Number.NaN} />);

    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.textContent).not.toContain("NaN");
  });

  test("describes what the dots measure", () => {
    render(<LatencyDots latencyMs={12} />);

    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("本地耗时");
  });
});

describe("ProviderCard", () => {
  test("renders a hit", () => {
    render(<ProviderCard provider={provider()} />);

    expect(screen.getByText("已命中")).toBeTruthy();
    expect(screen.getByText("中国")).toBeTruthy();
    expect(screen.getByText("China Mobile")).toBeTruthy();
  });

  test("renders a provider without a location as a muted miss, not a failure", () => {
    const { container } = render(<ProviderCard provider={provider({ location: null })} />);

    expect(screen.getByText("无地理信息")).toBeTruthy();
    expect(screen.queryByText("查询失败")).toBeNull();
    expect(container.querySelectorAll(".bg-basalt-muted-foreground").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".bg-basalt-tag-danger-foreground")).toHaveLength(0);
  });

  test("renders a failed provider as an error", () => {
    const { container } = render(
      <ProviderCard provider={provider({ location: null, error: true })} />,
    );

    expect(screen.getByText("查询失败")).toBeTruthy();
    expect(container.querySelectorAll(".bg-basalt-tag-danger-foreground").length).toBeGreaterThan(
      0,
    );
  });
});

describe("MetaBadge", () => {
  test("renders the tone classes and exposes the full value as a title", () => {
    const { container } = render(<MetaBadge tone="violet">ASN 9808</MetaBadge>);
    const badge = container.firstElementChild;
    expect(badge?.textContent).toBe("ASN 9808");
    expect(badge?.getAttribute("title")).toBe("ASN 9808");
    expect(String(badge?.className)).toContain("bg-basalt-tag-violet");
  });
});
