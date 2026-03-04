'use client';

import { useCallback, useState } from 'react';
import { LANGUAGES } from '@/lib/constants/environments';
import {
  matchDetectedByEnvType,
  toLogicalEnvType,
} from '@/lib/environment-detection';
import * as tauri from '@/lib/tauri';
import type {
  DetectedEnvironment,
  EnvironmentInfo,
  EnvironmentProviderInfo,
  SystemEnvironmentInfo,
} from '@/lib/tauri';

export type DetectionScope = 'system' | 'managed';

export interface OnboardingDetectedEnvironment {
  envType: string;
  name: string;
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
  systemDetections?: SystemEnvironmentInfo[];
  providers?: EnvironmentProviderInfo[];
}

const EMPTY_DETECTED_VERSIONS: DetectedEnvironment[] = [];
const EMPTY_AVAILABLE_PROVIDERS: EnvironmentProviderInfo[] = [];

function getEnvironmentDisplayName(envType: string): string {
  return LANGUAGES.find((lang) => lang.id === envType)?.name ?? envType;
}

export function useEnvironmentDetection(
  options: UseEnvironmentDetectionOptions = {},
) {
  const detectedVersions = options.detectedVersions ?? EMPTY_DETECTED_VERSIONS;
  const availableProviders = options.availableProviders ?? EMPTY_AVAILABLE_PROVIDERS;

  const [systemDetections, setSystemDetections] = useState<SystemEnvironmentInfo[]>([]);
  const [systemDetecting, setSystemDetecting] = useState(false);
  const [systemDetectError, setSystemDetectError] = useState<string | null>(null);

  const getProjectDetectedForEnv = useCallback((envType: string) => (
    matchDetectedByEnvType(envType, detectedVersions, availableProviders)
  ), [availableProviders, detectedVersions]);

  const matchSystemByEnvType = useCallback((
    envType: string,
    candidates?: SystemEnvironmentInfo[],
  ) => {
    const targetEnvType = toLogicalEnvType(envType, availableProviders);
    const list = candidates ?? systemDetections;
    return (
      list.find(
        (entry) => toLogicalEnvType(entry.env_type, availableProviders) === targetEnvType,
      ) || null
    );
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
      const detected = await tauri.envDetectSystemAll(force);
      setSystemDetections(detected);
      return detected;
    } catch (error) {
      setSystemDetections([]);
      setSystemDetectError(error instanceof Error ? error.message : String(error));
      return [];
    } finally {
      setSystemDetecting(false);
    }
  }, []);

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
      if (rows.has(logicalEnvType)) {
        continue;
      }

      rows.set(logicalEnvType, {
        envType: logicalEnvType,
        name: getEnvironmentDisplayName(logicalEnvType),
        version: env.current_version ?? '',
        available: env.available,
        scope: 'managed',
      });
    }

    for (const systemEnv of systemInput) {
      const logicalEnvType = toLogicalEnvType(systemEnv.env_type, providers);
      rows.set(logicalEnvType, {
        envType: logicalEnvType,
        name: getEnvironmentDisplayName(logicalEnvType),
        version: systemEnv.version ?? '',
        available: true,
        source: systemEnv.source,
        sourcePath: systemEnv.executable_path,
        scope: 'system',
      });
    }

    return Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name));
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
