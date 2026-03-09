import type { DetectedEnvironment, EnvironmentProviderInfo } from '@/lib/tauri';
import { getLogicalEnvType } from '@/lib/stores/environment';

type ProviderLike = Pick<EnvironmentProviderInfo, 'id' | 'env_type'>;

function normalizeEnvType(envType: string): string {
  return envType.trim().toLowerCase();
}

function normalizeProviderId(providerId?: string | null): string {
  const normalized = providerId?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : 'unknown';
}

function normalizeProviders(providers: ProviderLike[]): ProviderLike[] {
  return providers.map((provider) => ({
    id: provider.id.toLowerCase(),
    env_type: provider.env_type.toLowerCase(),
  }));
}

export function toLogicalEnvType(
  envType: string,
  providers: ProviderLike[] = [],
): string {
  const normalized = normalizeEnvType(envType);
  const normalizedProviders = normalizeProviders(providers);
  return normalizeEnvType(getLogicalEnvType(normalized, normalizedProviders));
}

export function buildProviderDetectionKey(
  envType: string,
  providerId?: string | null,
): string {
  return `${normalizeEnvType(envType)}::${normalizeProviderId(providerId)}`;
}

export function matchDetectedByEnvType(
  envType: string,
  detectedVersions: Array<DetectedEnvironment & { provider_id?: string | null }>,
  providers: ProviderLike[] = [],
  providerId?: string | null,
): DetectedEnvironment | null {
  const targetEnvType = toLogicalEnvType(envType, providers);
  const normalizedProvider = providerId?.trim().toLowerCase();

  if (normalizedProvider) {
    const providerMatch = detectedVersions.find((detected) => (
      toLogicalEnvType(detected.env_type, providers) === targetEnvType
      && detected.provider_id?.trim().toLowerCase() === normalizedProvider
    ));
    if (providerMatch) {
      return providerMatch;
    }
  }

  return (
    detectedVersions.find(
      (detected) => toLogicalEnvType(detected.env_type, providers) === targetEnvType,
    ) || null
  );
}

function normalizeVersionToken(version: string): string {
  let normalized = version.trim().toLowerCase();
  if (!normalized) return '';

  normalized = normalized.replace(/^v/, '');

  if (normalized.startsWith('go') && /^\d/.test(normalized.slice(2))) {
    normalized = normalized.slice(2);
  }

  return normalized;
}

function hasBoundaryPrefix(full: string, prefix: string): boolean {
  if (!full.startsWith(prefix)) return false;
  if (full.length === prefix.length) return true;
  const next = full.charAt(prefix.length);
  return next === '.' || next === '-';
}

export function isDetectedVersionCompatible(
  installedVersion: string,
  detectedVersion: string,
): boolean {
  const installed = normalizeVersionToken(installedVersion);
  const detected = normalizeVersionToken(detectedVersion);
  if (!installed || !detected) return false;
  return hasBoundaryPrefix(installed, detected) || hasBoundaryPrefix(detected, installed);
}

export function formatDetectionSource(source: string, sourceType?: string): string {
  if (sourceType === 'global') {
    return 'global default';
  }
  if (sourceType === 'manifest') {
    return 'project manifest';
  }
  return source.replaceAll('_', ' ').trim();
}
