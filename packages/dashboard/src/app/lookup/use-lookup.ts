import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ApiClient,
  describeError,
  type LookupResponse,
  type ProviderResult,
} from "../../lib/api";

export interface LookupViewModel {
  ip: string;
  version: 4 | 6;
  location: LookupResponse["location"];
  source: string;
  attribution: string[];
  latencyMs: number;
  providers: ProviderResult[];
}

export interface LookupState {
  loading: boolean;
  error: string | null;
  model: LookupViewModel | null;
}

export function buildLookupViewModel(response: LookupResponse): LookupViewModel {
  return {
    ip: response.ip,
    version: response.version,
    location: response.location,
    source: response.source,
    attribution: response.attribution,
    latencyMs: response.latencyMs,
    providers: response.providers ?? [],
  };
}

export async function runLookup(client: ApiClient, ip: string): Promise<LookupViewModel> {
  return buildLookupViewModel(await client.lookup(ip));
}

export function useLookup(
  client: ApiClient,
): LookupState & { submit: (ip: string) => Promise<void>; reset: () => void } {
  const [state, setState] = useState<LookupState>({ loading: false, error: null, model: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((next: LookupState) => {
    if (!mounted.current) return;
    setState(next);
  }, []);

  const submit = useCallback(
    async (ip: string) => {
      update({ loading: true, error: null, model: null });
      try {
        update({ loading: false, error: null, model: await runLookup(client, ip) });
      } catch (error) {
        update({ loading: false, error: describeError(error), model: null });
      }
    },
    [client, update],
  );

  const reset = useCallback(() => {
    update({ loading: false, error: null, model: null });
  }, [update]);

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    void submit("");
  }, [submit]);

  return { ...state, submit, reset };
}
