import { useCallback, useEffect, useRef, useState } from "react";
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
  creating: boolean;
  revoking: boolean;
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
  const [state, setState] = useState<KeysState>({
    loading: true,
    error: null,
    model: null,
    creating: false,
    revoking: false,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((patch: Partial<KeysState>) => {
    if (!mounted.current) return;
    setState((previous) => ({ ...previous, ...patch }));
  }, []);

  const reload = useCallback(async () => {
    update({ loading: true, error: null });
    try {
      update({ loading: false, model: await loadKeys(client) });
    } catch (error) {
      update({ loading: false, error: describeError(error) });
    }
  }, [client, update]);

  const create = useCallback(
    async (name: string) => {
      update({ creating: true, error: null });
      try {
        const created = await client.createKey(name);
        if (!mounted.current) return null;
        update({ creating: false });
        void reload();
        return created;
      } catch (error) {
        update({ creating: false, error: describeError(error) });
        return null;
      }
    },
    [client, reload, update],
  );

  const revoke = useCallback(
    async (id: string) => {
      update({ revoking: true, error: null });
      try {
        await client.revokeKey(id);
        update({ revoking: false });
        void reload();
        return true;
      } catch (error) {
        update({ revoking: false, error: describeError(error) });
        return false;
      }
    },
    [client, reload, update],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload, create, revoke };
}
