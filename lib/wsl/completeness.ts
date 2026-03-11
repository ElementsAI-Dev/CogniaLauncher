import type {
  WslCapabilities,
  WslDistroStatus,
  WslRuntimeSnapshot,
  WslStatus,
} from '@/types/tauri';
import type {
  WslCompletenessSnapshot,
  WslFailureCategory,
  WslOperationFailure,
  WslOperationGate,
  WslOperationId,
} from '@/types/wsl';

type WslOperationDescriptor = {
  capability?: keyof WslCapabilities;
  reason: string;
};

const OPERATION_DESCRIPTORS: Record<WslOperationId, WslOperationDescriptor> = {
  'runtime.importInPlace': {
    capability: 'importInPlace',
    reason: 'Import in-place is not supported by this WSL runtime.',
  },
  'runtime.mount': {
    reason: 'Disk mount operations require an available WSL runtime.',
  },
  'runtime.mountWithOptions': {
    capability: 'mountOptions',
    reason: 'Mount options are not supported by this WSL runtime.',
  },
  'distro.setSparse': {
    capability: 'setSparse',
    reason: 'Sparse VHD mode is not supported by this WSL runtime.',
  },
  'network.portForward': {
    reason: 'Port forwarding requires an available WSL runtime.',
  },
  'distro.healthCheck': {
    reason: 'Distro health check requires an available WSL runtime.',
  },
};

export function resolveWslOperationGate(
  operationId: WslOperationId,
  available: boolean | null,
  capabilities: WslCapabilities | null,
  runtimeSnapshot?: WslRuntimeSnapshot | null
): WslOperationGate {
  if (runtimeSnapshot?.available === false) {
    return {
      supported: false,
      reason: runtimeSnapshot.reason || 'WSL runtime is unavailable on this host.',
    };
  }

  if (available === false) {
    return {
      supported: false,
      reason: 'WSL runtime is unavailable on this host.',
    };
  }

  const descriptor = OPERATION_DESCRIPTORS[operationId];
  if (!descriptor.capability) {
    return { supported: true };
  }

  if (
    runtimeSnapshot?.state === 'degraded'
    && runtimeSnapshot.capabilityProbe.ready === false
  ) {
    return {
      supported: false,
      capability: descriptor.capability,
      reason: runtimeSnapshot.capabilityProbe.detail
        ?? 'Runtime capability detection is degraded. Refresh runtime state and retry.',
    };
  }

  // When capability payload is unavailable, stay permissive and let backend decide.
  if (!capabilities) {
    return { supported: true };
  }

  if (capabilities[descriptor.capability] === false) {
    return {
      supported: false,
      capability: descriptor.capability,
      reason: descriptor.reason,
    };
  }

  return { supported: true };
}

export function classifyWslFailure(rawError: string): WslFailureCategory {
  const message = rawError.toLowerCase();
  if (message.includes('[wsl_unsupported') || message.includes('unsupported')) {
    return 'unsupported';
  }
  if (
    message.includes('access is denied')
    || message.includes('permission denied')
    || message.includes('administrator')
    || message.includes('elevation')
  ) {
    return 'permission';
  }
  if (
    message.includes('[wsl_runtime:')
    || message.includes('runtime_unavailable')
    || message.includes('wsl runtime is unavailable')
    || message.includes('wsl is unavailable')
    || message.includes('distribution not found')
    || message.includes('not running')
    || message.includes('kernel')
    || message.includes('timeout')
  ) {
    return 'runtime';
  }
  return 'operation';
}

export function buildWslFailure(rawError: unknown): WslOperationFailure {
  const raw = String(rawError);
  return {
    category: classifyWslFailure(raw),
    message: raw,
    raw,
  };
}

export function deriveWslCompleteness(
  available: boolean | null,
  distros: WslDistroStatus[],
  status: WslStatus | null,
  capabilities: WslCapabilities | null,
  runtimeSnapshot?: WslRuntimeSnapshot | null
): WslCompletenessSnapshot {
  const distroCount = distros.length > 0
    ? distros.length
    : runtimeSnapshot?.distroCount ?? 0;
  const runningCount = distros.filter((d) => (d.state ?? '').toLowerCase() === 'running').length;
  const degradedReasons: string[] = [];

  if (runtimeSnapshot) {
    const reasons = runtimeSnapshot.state === 'degraded'
      ? runtimeSnapshot.degradedReasons
      : runtimeSnapshot.state === 'unavailable'
        ? [runtimeSnapshot.reason]
        : [];
    return {
      state: runtimeSnapshot.state,
      available: runtimeSnapshot.available,
      distroCount,
      runningCount,
      degradedReasons: reasons.length > 0 ? reasons : runtimeSnapshot.reason ? [runtimeSnapshot.reason] : [],
    };
  }

  if (available === null) {
    return {
      state: 'degraded',
      available: false,
      distroCount,
      runningCount,
      degradedReasons: ['WSL runtime availability has not been resolved yet.'],
    };
  }

  if (available === false) {
    return {
      state: 'unavailable',
      available: false,
      distroCount: 0,
      runningCount: 0,
      degradedReasons: ['WSL runtime is unavailable.'],
    };
  }

  if (available === true && distroCount === 0) {
    return {
      state: 'empty',
      available: true,
      distroCount,
      runningCount,
      degradedReasons: [],
    };
  }

  if (available === true && !status) {
    degradedReasons.push('Runtime status data is unavailable.');
  }
  if (available === true && capabilities === null) {
    degradedReasons.push('Runtime capabilities could not be detected.');
  }

  return {
    state: degradedReasons.length > 0 ? 'degraded' : 'ready',
    available: available === true,
    distroCount,
    runningCount,
    degradedReasons,
  };
}
