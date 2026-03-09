'use client';

import { useCallback, useState } from 'react';
import { LANGUAGES } from '@/lib/constants/environments';
import {
  buildProviderDetectionKey,
  matchDetectedByEnvType,
  toLogicalEnvType,
} from '@/lib/environment-detection';
import * as tauri from '@/lib/tauri';
import type {
  DetectedEnvironment,
  EnvironmentInfo,
  EnvironmentProviderInfo,
  ProviderDetectedEnvironmentInfo,
  SystemEnvironmentInfo,
} from '@/lib/tauri';

export type DetectionScope = 'system' | 'managed';

export interface OnboardingDetectedEnvironment {
  detectionKey: string;
  envType: string;
  name: string;
  providerId?: string;
  providerName?: string;
  version: string;
  available: boolean;
  source?: string;
  sourcePath?: string | null;
  scope?: DetectionScope;
}

interface UseEnvironmentDetectionOptions {
  detectedVersions?: DetectedEnvironment[];
  availableProviders?: EnvironmentProviderInfo[];
}

interface BuildOnboardingDetectionsOptions {
  environments: EnvironmentInfo[];
  systemDetections?: ProviderDetectedEnvironmentInfo[];
  providers?: EnvironmentProviderInfo[];
}

const EMPTY_DETECTED_VERSIONS: DetectedEnvironment[] = [];
const EMPTY_AVAILABLE_PROVIDERS: EnvironmentProviderInfo[] = [];

function getEnvironmentDisplayName(envType: string): string {
  return LANGUAGES.find((lang) => lang.id === envType)?.name ?? envType;
}

function inferProviderScope(providerId: string): DetectionScope {
  if (
    providerId.startsWith('system-')
    || providerId === 'msvc'
    || providerId === 'msys2'
  ) {
    return 'system';
  }
  return 'managed';
}

function normalizeProviderDetection(
  detection: ProviderDetectedEnvironmentInfo | SystemEnvironmentInfo,
  providers: EnvironmentProviderInfo[],
): ProviderDetectedEnvironmentInfo {
  if ('provider_id' in detection) {
    return detection;
  }

  const logicalEnvType = toLogicalEnvType(detection.env_type, providers);
  const providerId = `system-${logicalEnvType}`;

  return {
    env_type: logicalEnvType,
    provider_id: providerId,
    provider_name: 'System',
    version: detection.version,
    executable_path: detection.executable_path,
    source: detection.source,
    scope: 'system',
  };
}

export function useEnvironmentDetection(
  options: UseEnvironmentDetectionOptions = {},
) {
  const detectedVersions = options.detectedVersions ?? EMPTY_DETECTED_VERSIONS;
  const availableProviders = options.availableProviders ?? EMPTY_AVAILABLE_PROVIDERS;

  const [systemDetections, setSystemDetections] = useState<ProviderDetectedEnvironmentInfo[]>([]);
  const [systemDetecting, setSystemDetecting] = useState(false);
  const [systemDetectError, setSystemDetectError] = useState<string | null>(null);

  const getProjectDetectedForEnv = useCallback((
    envType: string,
    providerId?: string | null,
  ) => (
    matchDetectedByEnvType(envType, detectedVersions, availableProviders, providerId)
  ), [availableProviders, detectedVersions]);

  const matchSystemByEnvType = useCallback((
    envType: string,
    providerId?: string | null,
    candidates?: ProviderDetectedEnvironmentInfo[],
  ) => {
    const targetEnvType = toLogicalEnvType(envType, availableProviders);
    const targetProviderId = providerId?.trim().toLowerCase();
    const list = candidates ?? systemDetections;

    if (targetProviderId) {
      const providerMatch = list.find((entry) => (
        toLogicalEnvType(entry.env_type, availableProviders) === targetEnvType
        && entry.provider_id.trim().toLowerCase() === targetProviderId
      ));
      if (providerMatch) {
        return providerMatch;
      }
    }

    return list.find(
      (entry) => toLogicalEnvType(entry.env_type, availableProviders) === targetEnvType,
    ) || null;
  }, [availableProviders, systemDetections]);

  const detectSystemEnvironments = useCallback(async (force?: boolean) => {
    if (!tauri.isTauri()) {
      setSystemDetections([]);
      setSystemDetectError(null);
      return [];
    }

    setSystemDetecting(true);
    setSystemDetectError(null);

    try {
      const detected = typeof tauri.envDetectProvidersAll === 'function'
        ? await tauri.envDetectProvidersAll(force)
        : (await tauri.envDetectSystemAll(force)).map((entry) => (
          normalizeProviderDetection(entry, availableProviders)
        ));
      setSystemDetections(detected);
      return detected;
    } catch (error) {
      setSystemDetections([]);
      const message = error instanceof Error ? error.message : String(error);
      setSystemDetectError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setSystemDetecting(false);
    }
  }, [availableProviders]);

  const buildOnboardingDetections = useCallback((
    {
      environments,
      systemDetections: systemInput = systemDetections,
      providers = availableProviders,
    }: BuildOnboardingDetectionsOptions,
  ): OnboardingDetectedEnvironment[] => {
    const rows = new Map<string, OnboardingDetectedEnvironment>();

    for (const env of environments) {
      const logicalEnvType = toLogicalEnvType(env.env_type, providers);
      const providerId = env.provider_id?.trim().toLowerCase() || logicalEnvType;
      const providerName = env.provider || providerId;
      const detectionKey = buildProviderDetectionKey(logicalEnvType, providerId);

      rows.set(detectionKey, {
        detectionKey,
        envType: logicalEnvType,
        name: getEnvironmentDisplayName(logicalEnvType),
        providerId,
        providerName,
        version: env.current_version ?? '',
        available: env.available,
        scope: 'managed',
      });
    }

    for (const systemEnvRaw of systemInput) {
      const systemEnv = normalizeProviderDetection(systemEnvRaw, providers);
      const logicalEnvType = toLogicalEnvType(systemEnv.env_type, providers);
      const providerId = systemEnv.provider_id.trim().toLowerCase();
      const detectionKey = buildProviderDetectionKey(logicalEnvType, providerId);
      rows.set(detectionKey, {
        detectionKey,
        envType: logicalEnvType,
        name: getEnvironmentDisplayName(logicalEnvType),
        providerId,
        providerName: systemEnv.provider_name,
        version: systemEnv.version ?? '',
        available: true,
        source: systemEnv.source,
        sourcePath: systemEnv.executable_path,
        scope: systemEnv.scope === 'managed' || systemEnv.scope === 'system'
          ? systemEnv.scope
          : inferProviderScope(providerId),
      });
    }

    return Array.from(rows.values()).sort((a, b) => (
      a.name.localeCompare(b.name)
      || (a.providerName ?? '').localeCompare(b.providerName ?? '')
    ));
  }, [availableProviders, systemDetections]);

  return {
    getProjectDetectedForEnv,
    matchSystemByEnvType,
    detectSystemEnvironments,
    buildOnboardingDetections,
    systemDetections,
    systemDetecting,
    systemDetectError,
  };
}
