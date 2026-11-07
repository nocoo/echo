import { useCallback, useEffect, useState } from "react";
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

  const submit = useCallback(
    async (ip: string) => {
      setState({ loading: true, error: null, model: null });
      try {
        setState({ loading: false, error: null, model: await runLookup(client, ip) });
      } catch (error) {
        setState({ loading: false, error: describeError(error), model: null });
      }
    },
    [client],
  );

  const reset = useCallback(() => {
    setState({ loading: false, error: null, model: null });
  }, []);

  useEffect(() => {
    reset();
  }, [reset]);

  return { ...state, submit, reset };
}
