import type {
  WslCapabilities,
  WslDiskUsage,
  WslDistroEnvironment,
  WslDistroResources,
  WslRuntimeSnapshot,
  WslStatus,
  WslVersionInfo,
} from '@/types/tauri';
import type {
  WslDistroInfoSnapshot,
  WslFailureCategory,
  WslInfoFailure,
  WslInfoSection,
  WslInfoSectionState,
  WslRuntimeInfoSnapshot,
} from '@/types/wsl';
import { buildWslFailure } from '@/lib/wsl/completeness';

function maxUpdatedAt(values: Array<string | null | undefined>): string | null {
  const timestamps = values.filter((value): value is string => Boolean(value));
  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.reduce((latest, value) => (
    new Date(value).getTime() > new Date(latest).getTime() ? value : latest
  ));
}

function hasData<T>(section: WslInfoSection<T>): boolean {
  return section.data !== null;
}

export function createWslInfoFailure(
  error: unknown,
  options?: {
    retryable?: boolean;
    category?: WslFailureCategory;
  },
): WslInfoFailure {
  const failure = buildWslFailure(error);
  return {
    category: options?.category ?? failure.category,
    message: failure.message,
    raw: failure.raw,
    retryable: options?.retryable ?? true,
  };
}

export function createWslInfoSection<T>(
  state: WslInfoSectionState = 'idle',
  data: T | null = null,
): WslInfoSection<T> {
  return {
    state,
    data,
    failure: null,
    reason: undefined,
    updatedAt: null,
  };
}

export function createUnavailableWslInfoSection<T>(reason: string): WslInfoSection<T> {
  return {
    state: 'unavailable',
    data: null,
    failure: null,
    reason,
    updatedAt: null,
  };
}

export function resolveWslInfoSuccess<T>(
  _previous: WslInfoSection<T> | null | undefined,
  data: T,
  updatedAt = new Date().toISOString(),
): WslInfoSection<T> {
  return {
    state: 'ready',
    data,
    failure: null,
    reason: undefined,
    updatedAt,
  };
}

export function resolveWslInfoFailure<T>(
  previous: WslInfoSection<T> | null | undefined,
  error: unknown,
  options?: {
    reason?: string;
    retryable?: boolean;
    category?: WslFailureCategory;
  },
): WslInfoSection<T> {
  const failure = createWslInfoFailure(error, {
    retryable: options?.retryable,
    category: options?.category,
  });

  if (previous?.data !== null && previous?.data !== undefined) {
    return {
      state: 'stale',
      data: previous.data,
      failure,
      reason: options?.reason,
      updatedAt: previous.updatedAt ?? null,
    };
  }

  return {
    state: 'failed',
    data: null,
    failure,
    reason: options?.reason,
    updatedAt: null,
  };
}

function summarizeInfoStates(states: WslInfoSectionState[], hasUnavailableData = false): WslInfoSectionState {
  const filtered = states.filter((state) => state !== 'idle');
  if (filtered.length === 0) {
    return 'idle';
  }
  if (filtered.every((state) => state === 'loading')) {
    return 'loading';
  }
  if (filtered.every((state) => state === 'ready')) {
    return 'ready';
  }
  if (filtered.every((state) => state === 'ready' || state === 'stale')) {
    return filtered.includes('stale') ? 'stale' : 'ready';
  }
  if (filtered.every((state) => state === 'unavailable')) {
    return 'unavailable';
  }
  if (filtered.every((state) => state === 'failed')) {
    return 'failed';
  }
  if (hasUnavailableData && filtered.every((state) => state === 'ready' || state === 'unavailable')) {
    return 'partial';
  }
  return 'partial';
}

export function deriveWslRuntimeInfoState(snapshot: WslRuntimeInfoSnapshot): WslInfoSectionState {
  if (snapshot.runtime.state === 'unavailable' || snapshot.runtime.data?.available === false) {
    return 'unavailable';
  }

  return summarizeInfoStates([
    snapshot.runtime.state,
    snapshot.status.state,
    snapshot.capabilities.state,
    snapshot.versionInfo.state,
  ]);
}

export function deriveWslDistroInfoState(snapshot: WslDistroInfoSnapshot): WslInfoSectionState {
  const liveStates = [
    snapshot.ipAddress.state,
    snapshot.environment.state,
    snapshot.resources.state,
  ];

  const state = summarizeInfoStates([
    snapshot.diskUsage.state,
    ...liveStates,
  ], true);

  if (
    snapshot.distroState?.toLowerCase() !== 'running'
    && snapshot.diskUsage.state === 'ready'
    && liveStates.every((entry) => entry === 'unavailable')
  ) {
    return 'partial';
  }

  return state;
}

export function createEmptyWslRuntimeInfoSnapshot(): WslRuntimeInfoSnapshot {
  const snapshot: WslRuntimeInfoSnapshot = {
    state: 'idle',
    runtime: createWslInfoSection<WslRuntimeSnapshot>(),
    status: createWslInfoSection<WslStatus>(),
    capabilities: createWslInfoSection<WslCapabilities>(),
    versionInfo: createWslInfoSection<WslVersionInfo>(),
    lastUpdatedAt: null,
  };
  return snapshot;
}

export function createEmptyWslDistroInfoSnapshot(
  distroName: string,
  distroState: string | null = null,
): WslDistroInfoSnapshot {
  return {
    distroName,
    distroState,
    state: 'idle',
    diskUsage: createWslInfoSection<WslDiskUsage>(),
    ipAddress: createWslInfoSection<string>(),
    environment: createWslInfoSection<WslDistroEnvironment>(),
    resources: createWslInfoSection<WslDistroResources>(),
    lastUpdatedAt: null,
  };
}

export function finalizeWslRuntimeInfoSnapshot(
  snapshot: WslRuntimeInfoSnapshot,
): WslRuntimeInfoSnapshot {
  const state = deriveWslRuntimeInfoState(snapshot);
  return {
    ...snapshot,
    state,
    lastUpdatedAt: maxUpdatedAt([
      snapshot.runtime.updatedAt,
      snapshot.status.updatedAt,
      snapshot.capabilities.updatedAt,
      snapshot.versionInfo.updatedAt,
    ]),
  };
}

export function finalizeWslDistroInfoSnapshot(
  snapshot: WslDistroInfoSnapshot,
): WslDistroInfoSnapshot {
  return {
    ...snapshot,
    state: deriveWslDistroInfoState(snapshot),
    lastUpdatedAt: maxUpdatedAt([
      snapshot.diskUsage.updatedAt,
      snapshot.ipAddress.updatedAt,
      snapshot.environment.updatedAt,
      snapshot.resources.updatedAt,
    ]),
  };
}

export function syncWslDistroInfoSnapshots(
  nextDistros: Array<{ name: string; state?: string }>,
  current: Record<string, WslDistroInfoSnapshot>,
): Record<string, WslDistroInfoSnapshot> {
  const synced: Record<string, WslDistroInfoSnapshot> = {};

  for (const distro of nextDistros) {
    const existing = current[distro.name];
    synced[distro.name] = existing
      ? finalizeWslDistroInfoSnapshot({
        ...existing,
        distroState: distro.state ?? existing.distroState,
      })
      : createEmptyWslDistroInfoSnapshot(distro.name, distro.state ?? null);
  }

  return synced;
}

export function beginWslInfoLoading<T>(
  previous: WslInfoSection<T> | null | undefined,
  reason?: string,
): WslInfoSection<T> {
  return {
    state: 'loading',
    data: previous?.data ?? null,
    failure: previous?.failure ?? null,
    reason,
    updatedAt: previous?.updatedAt ?? null,
  };
}

export function hasWslInfoData<T>(section: WslInfoSection<T>): boolean {
  return hasData(section);
}
