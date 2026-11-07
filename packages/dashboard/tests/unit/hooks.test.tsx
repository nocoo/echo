import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useKeys } from "../../src/app/keys/use-keys";
import { useLookup } from "../../src/app/lookup/use-lookup";
import { useOverview } from "../../src/app/overview/use-overview";
import type {
  ApiClient,
  ApiKey,
  CreatedApiKey,
  LookupResponse,
  OverviewResponse,
} from "../../src/lib/api";

function apiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: "key-1",
    name: "ci",
    key_prefix: "echo_abcdefgh",
    status: "active",
    created_by: "owner@example.com",
    created_at: 1,
    last_used_at: null,
    revoked_at: null,
    ...overrides,
  };
}

function createdKey(secret = "echo_secret"): CreatedApiKey {
  return { apiKey: apiKey(), secret };
}

function overview(): OverviewResponse {
  return {
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
    ],
    summary: { present: 1, missing: 0, ageDays: 1, stale: false },
  };
}

function lookupResponse(): LookupResponse {
  return {
    ip: "8.8.8.8",
    version: 4,
    location: null,
    source: "ip2region",
    attribution: ["ip2region"],
    latencyMs: 12,
    providers: [],
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolveInner) => {
    resolve = resolveInner;
  });
  return { promise, resolve };
}

function stubClient(overrides: Partial<Record<keyof ApiClient, unknown>>): ApiClient {
  return overrides as unknown as ApiClient;
}

describe("useKeys", () => {
  test("loads the key list", async () => {
    const client = stubClient({
      listKeys: vi.fn(async () => [apiKey(), apiKey({ id: "key-2", status: "revoked" })]),
    });

    const { result } = renderHook(() => useKeys(client));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.model?.activeCount).toBe(1);
    expect(result.current.model?.revokedCount).toBe(1);
    expect(result.current.error).toBeNull();
  });

  test("reports a load failure", async () => {
    const client = stubClient({
      listKeys: vi.fn(async () => {
        throw new Error("unauthorized");
      }),
    });

    const { result } = renderHook(() => useKeys(client));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("unauthorized");
    expect(result.current.model).toBeNull();
  });

  test("returns the secret without waiting for the list refresh", async () => {
    const refreshed = deferred<ApiKey[]>();
    const listKeys = vi.fn().mockResolvedValueOnce([]).mockReturnValueOnce(refreshed.promise);
    const client = stubClient({ listKeys, createKey: vi.fn(async () => createdKey()) });

    const { result } = renderHook(() => useKeys(client));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: CreatedApiKey | null = null;
    await act(async () => {
      created = await result.current.create("ci");
    });

    expect(created).not.toBeNull();
    expect((created as unknown as CreatedApiKey).secret).toBe("echo_secret");
    expect(result.current.creating).toBe(false);
    expect(result.current.loading).toBe(true);
  });

  test("reports a create failure and clears the pending flag", async () => {
    const client = stubClient({
      listKeys: vi.fn(async () => []),
      createKey: vi.fn(async () => {
        throw new Error("name is required");
      }),
    });

    const { result } = renderHook(() => useKeys(client));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: CreatedApiKey | null = createdKey();
    await act(async () => {
      created = await result.current.create("");
    });

    expect(created).toBeNull();
    expect(result.current.creating).toBe(false);
    expect(result.current.error).toBe("name is required");
  });

  test("drops a create result that arrives after unmount", async () => {
    const pending = deferred<CreatedApiKey>();
    const client = stubClient({
      listKeys: vi.fn(async () => []),
      createKey: vi.fn(() => pending.promise),
    });

    const { result, unmount } = renderHook(() => useKeys(client));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let createPromise: Promise<CreatedApiKey | null> | null = null;
    await act(async () => {
      createPromise = result.current.create("ci");
    });

    unmount();
    pending.resolve(createdKey());
    await act(async () => {
      await createPromise;
    });

    await expect(createPromise).resolves.toBeNull();
  });

  test("ignores a list refresh that arrives after unmount", async () => {
    const pending = deferred<ApiKey[]>();
    const client = stubClient({ listKeys: vi.fn(() => pending.promise) });

    const { result, unmount } = renderHook(() => useKeys(client));
    expect(result.current.loading).toBe(true);
    unmount();

    pending.resolve([apiKey()]);
    await act(async () => {
      await pending.promise;
    });

    expect(result.current.model).toBeNull();
  });

  test("revokes and refreshes the list", async () => {
    const listKeys = vi
      .fn()
      .mockResolvedValueOnce([apiKey()])
      .mockResolvedValueOnce([apiKey({ status: "revoked" })]);
    const client = stubClient({ listKeys, revokeKey: vi.fn(async () => undefined) });

    const { result } = renderHook(() => useKeys(client));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let revoked = false;
    await act(async () => {
      revoked = await result.current.revoke("key-1");
    });

    expect(revoked).toBe(true);
    expect(result.current.revoking).toBe(false);
    await waitFor(() => expect(result.current.model?.revokedCount).toBe(1));
  });

  test("reports a revoke failure", async () => {
    const client = stubClient({
      listKeys: vi.fn(async () => [apiKey()]),
      revokeKey: vi.fn(async () => {
        throw new Error("api key not found");
      }),
    });

    const { result } = renderHook(() => useKeys(client));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let revoked = true;
    await act(async () => {
      revoked = await result.current.revoke("missing");
    });

    expect(revoked).toBe(false);
    expect(result.current.revoking).toBe(false);
    expect(result.current.error).toBe("api key not found");
  });
});

describe("useOverview", () => {
  test("loads the overview", async () => {
    const client = stubClient({
      overview: vi.fn(async () => overview()),
      listKeys: vi.fn(async () => [apiKey()]),
    });

    const { result } = renderHook(() => useOverview(client));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.model?.stats.status).toBe("ok");
    expect(result.current.model?.stats.keyCount).toBe(1);
  });

  test("reports a load failure and recovers on reload", async () => {
    const overviewCall = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(overview());
    const client = stubClient({ overview: overviewCall, listKeys: vi.fn(async () => []) });

    const { result } = renderHook(() => useOverview(client));

    await waitFor(() => expect(result.current.error).toBe("boom"));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.model).not.toBeNull();
  });

  test("ignores a result that arrives after unmount", async () => {
    const pending = deferred<OverviewResponse>();
    const client = stubClient({
      overview: vi.fn(() => pending.promise),
      listKeys: vi.fn(async () => []),
    });

    const { result, unmount } = renderHook(() => useOverview(client));
    unmount();

    pending.resolve(overview());
    await act(async () => {
      await pending.promise;
    });

    expect(result.current.model).toBeNull();
  });
});

describe("useLookup", () => {
  test("submits a lookup", async () => {
    const client = stubClient({ lookup: vi.fn(async () => lookupResponse()) });

    const { result } = renderHook(() => useLookup(client));

    await act(async () => {
      await result.current.submit("8.8.8.8");
    });

    expect(result.current.model?.ip).toBe("8.8.8.8");
    expect(result.current.loading).toBe(false);
  });

  test("reports a lookup failure", async () => {
    const client = stubClient({
      lookup: vi.fn(async () => {
        throw new Error("invalid ip");
      }),
    });

    const { result } = renderHook(() => useLookup(client));

    await act(async () => {
      await result.current.submit("nope");
    });

    expect(result.current.error).toBe("invalid ip");
    expect(result.current.model).toBeNull();
  });

  test("resets the result", async () => {
    const client = stubClient({ lookup: vi.fn(async () => lookupResponse()) });

    const { result } = renderHook(() => useLookup(client));

    await act(async () => {
      await result.current.submit("8.8.8.8");
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.model).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test("ignores a result that arrives after unmount", async () => {
    const pending = deferred<LookupResponse>();
    const client = stubClient({ lookup: vi.fn(() => pending.promise) });

    const { result, unmount } = renderHook(() => useLookup(client));

    let submission: Promise<void> | null = null;
    await act(async () => {
      submission = result.current.submit("8.8.8.8");
    });

    unmount();
    pending.resolve(lookupResponse());
    await act(async () => {
      await submission;
    });

    expect(result.current.model).toBeNull();
  });
});
