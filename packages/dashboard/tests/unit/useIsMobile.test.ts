import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { isMobileViewport, useIsMobile } from "../../src/lib/use-is-mobile";

const listeners = new Set<() => void>();
let matches = false;

function stubMatchMedia(): void {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return matches;
        },
        media: query,
        onchange: null,
        addEventListener: (_event: string, callback: () => void) => {
          listeners.add(callback);
        },
        removeEventListener: (_event: string, callback: () => void) => {
          listeners.delete(callback);
        },
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  listeners.clear();
  matches = false;
  vi.restoreAllMocks();
});

describe("useIsMobile", () => {
  test("starts from the viewport query", () => {
    matches = false;
    stubMatchMedia();

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  test("follows the media query and unsubscribes on unmount", () => {
    matches = true;
    stubMatchMedia();

    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    matches = false;
    act(() => {
      for (const listener of listeners) listener();
    });
    expect(result.current).toBe(false);
    expect(listeners.size).toBe(1);

    unmount();
    expect(listeners.size).toBe(0);
  });

  test("exposes the viewport check", () => {
    matches = true;
    stubMatchMedia();
    expect(isMobileViewport()).toBe(true);
  });
});
