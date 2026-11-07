import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ApiClient,
  type ApiKey,
  type DatabaseEntry,
  describeError,
  type OverviewResponse,
} from "../../lib/api";

export type FreshnessStatus = "ok" | "stale" | "unknown";

export interface OverviewStats {
  ageDays: number | null;
  status: FreshnessStatus;
  databaseCount: number;
  presentCount: number;
  missingCount: number;
  keyCount: number;
}

export interface OverviewViewModel {
  stats: OverviewStats;
  databases: DatabaseEntry[];
}

export interface OverviewState {
  loading: boolean;
  error: string | null;
  model: OverviewViewModel | null;
}

export function buildOverviewViewModel(
  overview: OverviewResponse,
  keys: ApiKey[],
): OverviewViewModel {
  const ageDays = overview.summary.ageDays;
  const status: FreshnessStatus =
    ageDays === null ? "unknown" : overview.summary.stale ? "stale" : "ok";

  return {
    stats: {
      ageDays,
      status,
      databaseCount: overview.databases.length,
      presentCount: overview.summary.present,
      missingCount: overview.summary.missing,
      keyCount: keys.length,
    },
    databases: overview.databases,
  };
}

export async function loadOverview(client: ApiClient): Promise<OverviewViewModel> {
  const [overview, keys] = await Promise.all([client.overview(), client.listKeys()]);
  return buildOverviewViewModel(overview, keys);
}

export function useOverview(client: ApiClient): OverviewState & { reload: () => Promise<void> } {
  const [state, setState] = useState<OverviewState>({ loading: true, error: null, model: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((patch: Partial<OverviewState>) => {
    if (!mounted.current) return;
    setState((previous) => ({ ...previous, ...patch }));
  }, []);

  const reload = useCallback(async () => {
    update({ loading: true, error: null });
    try {
      update({ loading: false, model: await loadOverview(client) });
    } catch (error) {
      update({ loading: false, error: describeError(error) });
    }
  }, [client, update]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
