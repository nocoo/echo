import { describe, expect, test } from "vitest";
import {
  formatAgeDays,
  formatBytes,
  formatDate,
  formatDateTime,
  formatTimestamp,
} from "../../src/lib/format";

describe("formatBytes", () => {
  test("formats missing sizes", () => {
    expect(formatBytes(null)).toBe("—");
  });

  test("formats plain bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  test("formats scaled units", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe("1.0 TB");
    expect(formatBytes(1024 * 1024 * 1024 * 1024 * 1024)).toBe("1024.0 TB");
  });
});

describe("formatDate", () => {
  test("keeps the day part", () => {
    expect(formatDate("2026-01-02T03:04:05.000Z")).toBe("2026-01-02");
  });

  test("formats missing values", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatDateTime", () => {
  test("renders a readable timestamp", () => {
    expect(formatDateTime("2026-01-02T03:04:05.000Z")).toBe("2026-01-02 03:04:05");
  });

  test("keeps unparsable values", () => {
    expect(formatDateTime("not a date")).toBe("not a date");
  });

  test("formats missing values", () => {
    expect(formatDateTime(null)).toBe("—");
  });
});

describe("formatTimestamp", () => {
  test("renders epoch milliseconds", () => {
    expect(formatTimestamp(Date.parse("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02 03:04:05");
  });

  test("formats missing values", () => {
    expect(formatTimestamp(null)).toBe("—");
  });
});

describe("formatAgeDays", () => {
  test("renders the day count", () => {
    expect(formatAgeDays(3)).toBe("3 天");
    expect(formatAgeDays(0)).toBe("0 天");
  });

  test("formats missing values", () => {
    expect(formatAgeDays(null)).toBe("—");
  });
});
