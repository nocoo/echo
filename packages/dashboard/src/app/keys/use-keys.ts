import { useCallback, useEffect, useState } from "react";
import { type ApiClient, type ApiKey, type CreatedApiKey, describeError } from "../../lib/api";

export interface KeysViewModel {
  keys: ApiKey[];
  activeCount: number;
  revokedCount: number;
}

export interface KeysState {
  loading: boolean;
  error: string | null;
  model: KeysViewModel | null;
}

export function buildKeysViewModel(keys: ApiKey[]): KeysViewModel {
  return {
    keys,
    activeCount: keys.filter((key) => key.status === "active").length,
    revokedCount: keys.filter((key) => key.status === "revoked").length,
  };
}

export async function loadKeys(client: ApiClient): Promise<KeysViewModel> {
  return buildKeysViewModel(await client.listKeys());
}

export function useKeys(client: ApiClient): KeysState & {
  reload: () => Promise<void>;
  create: (name: string) => Promise<CreatedApiKey | null>;
  revoke: (id: string) => Promise<boolean>;
} {
  const [state, setState] = useState<KeysState>({ loading: true, error: null, model: null });

  const reload = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      setState({ loading: false, error: null, model: await loadKeys(client) });
    } catch (error) {
      setState({ loading: false, error: describeError(error), model: null });
    }
  }, [client]);

  const create = useCallback(
    async (name: string) => {
      try {
        const created = await client.createKey(name);
        await reload();
        return created;
      } catch (error) {
        setState((previous) => ({ ...previous, error: describeError(error) }));
        return null;
      }
    },
    [client, reload],
  );

  const revoke = useCallback(
    async (id: string) => {
      try {
        await client.revokeKey(id);
        await reload();
        return true;
      } catch (error) {
        setState((previous) => ({ ...previous, error: describeError(error) }));
        return false;
      }
    },
    [client, reload],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload, create, revoke };
}
