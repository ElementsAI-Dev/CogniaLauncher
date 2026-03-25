import type { cognia } from '@cognia/plugin-sdk';

export type EnvProviderAuditInput = {
  envTypes?: string[];
  includeProviders?: boolean;
  notifyOnIssues?: boolean;
  emitEvent?: boolean;
};

export type ProviderSnapshot = {
  id: string;
  displayName: string;
  capabilities: string[];
  platforms: string[];
  priority: number;
  enabled: boolean;
  isEnvironmentProvider: boolean;
};

export type EnvironmentSnapshot = {
  envType: string;
  declaredByHost: boolean;
  available: boolean;
  currentVersion: string | null;
  installedVersions: string[];
};

export type EnvProviderAuditSuccess = {
  ok: true;
  pluginId: string | null;
  auditedAt: string;
  platform: ReturnType<typeof cognia.platform.info>;
  providers: ProviderSnapshot[];
  environments: EnvironmentSnapshot[];
  issues: string[];
  recommendations: string[];
  message: string;
};

export type EnvProviderAuditFailure = {
  ok: false;
  errorCode: 'INVALID_INPUT' | 'HOST_CALL_FAILED';
  message: string;
  recommendations: string[];
};

export interface EnvProviderAuditHost {
  platform: Pick<typeof cognia.platform, 'info'>;
  env: Pick<typeof cognia.env, 'list' | 'providerList' | 'detect'>;
  event: Pick<typeof cognia.event, 'emit' | 'getPluginId'>;
  notification: Pick<typeof cognia.notification, 'send'>;
}

export const DEFAULT_ENV_TYPES = ['node', 'python', 'rust'];

export class AuditInputError extends Error {
  readonly code = 'INVALID_INPUT' as const;
}

export function parseEnvProviderAuditInput(
  raw: string,
): Required<EnvProviderAuditInput> {
  if (!raw.trim()) {
    return {
      envTypes: [...DEFAULT_ENV_TYPES],
      includeProviders: true,
      notifyOnIssues: false,
      emitEvent: true,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AuditInputError('Input must be valid JSON when provided.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AuditInputError('Input must be a JSON object.');
  }

  const candidate = parsed as EnvProviderAuditInput;
  const envTypes = normalizeEnvTypes(candidate.envTypes);

  return {
    envTypes,
    includeProviders: normalizeBoolean(
      candidate.includeProviders,
      true,
      'includeProviders',
    ),
    notifyOnIssues: normalizeBoolean(
      candidate.notifyOnIssues,
      false,
      'notifyOnIssues',
    ),
    emitEvent: normalizeBoolean(candidate.emitEvent, true, 'emitEvent'),
  };
}

function normalizeEnvTypes(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [...DEFAULT_ENV_TYPES];
  }
  if (!Array.isArray(value)) {
    throw new AuditInputError('envTypes must be an array of strings.');
  }

  const normalized = [
    ...new Set(
      value.map((item) => {
        if (typeof item !== 'string') {
          throw new AuditInputError('envTypes must contain only strings.');
        }
        const trimmed = item.trim();
        if (!trimmed) {
          throw new AuditInputError('envTypes cannot include empty values.');
        }
        return trimmed;
      }),
    ),
  ];

  if (normalized.length === 0) {
    throw new AuditInputError(
      'envTypes must include at least one environment type.',
    );
  }

  return normalized;
}

function normalizeBoolean(
  value: unknown,
  fallback: boolean,
  fieldName: string,
): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    throw new AuditInputError(`${fieldName} must be a boolean value.`);
  }
  return value;
}

export function runEnvProviderAudit(
  input: Required<EnvProviderAuditInput>,
  host: EnvProviderAuditHost,
): EnvProviderAuditSuccess {
  const platform = host.platform.info();
  const knownEnvironmentIds = new Set(host.env.list().map((entry) => entry.id));
  const providers = input.includeProviders
    ? host.env.providerList().map((provider) => ({
        id: provider.id,
        displayName: provider.displayName,
        capabilities: provider.capabilities,
        platforms: provider.platforms,
        priority: provider.priority,
        enabled: provider.enabled,
        isEnvironmentProvider: provider.isEnvironmentProvider,
      }))
    : [];

  const environments = input.envTypes.map((envType) => {
    const detection = host.env.detect(envType);
    return {
      envType,
      declaredByHost: knownEnvironmentIds.has(envType),
      available: detection.available,
      currentVersion: detection.currentVersion,
      installedVersions: detection.installedVersions,
    } satisfies EnvironmentSnapshot;
  });

  const issues = summarizeEnvProviderIssues(environments);
  const recommendations = buildEnvProviderRecommendations(
    environments,
    providers,
    issues.length,
  );
  const pluginId = safeGetPluginId(host);

  if (input.emitEvent) {
    host.event.emit('builtin.env_provider_audit.completed', {
      pluginId,
      issueCount: issues.length,
      auditedEnvTypes: environments.map((item) => item.envType),
      providerCount: providers.length,
    });
  }

  if (input.notifyOnIssues && issues.length > 0) {
    host.notification.send(
      'Environment audit found issues',
      `${issues.length} issue(s) detected in ${environments.length} checks.`,
    );
  }

  return {
    ok: true,
    pluginId,
    auditedAt: new Date().toISOString(),
    platform,
    providers,
    environments,
    issues,
    recommendations,
    message:
      issues.length === 0
        ? 'Environment provider audit completed with no issues.'
        : `Environment provider audit completed with ${issues.length} issue(s).`,
  };
}

export function summarizeEnvProviderIssues(
  environments: EnvironmentSnapshot[],
): string[] {
  const issues: string[] = [];
  for (const env of environments) {
    if (!env.available) {
      issues.push(`${env.envType}: environment is not available.`);
      continue;
    }
    if (!env.currentVersion) {
      issues.push(`${env.envType}: no current active version is selected.`);
    }
    if (env.installedVersions.length === 0) {
      issues.push(`${env.envType}: no installed versions were reported.`);
    }
  }
  return issues;
}

export function buildEnvProviderRecommendations(
  environments: EnvironmentSnapshot[],
  providers: ProviderSnapshot[],
  issueCount: number,
): string[] {
  if (issueCount === 0) {
    return [
      'All requested environments are available and have active version signals.',
      'Persist this output with your release checklist for reproducibility.',
    ];
  }

  const items = [
    'Install or enable the missing environment providers before running dependent tools.',
    'Set a current version for environments that report no active version.',
  ];

  if (providers.length === 0) {
    items.push(
      'Enable includeProviders=true to inspect provider capabilities for deeper diagnostics.',
    );
  }
  if (environments.some((env) => env.declaredByHost && !env.available)) {
    items.push(
      'A host-declared environment is unavailable; verify provider binaries and PATH configuration.',
    );
  }

  return items;
}

function safeGetPluginId(host: EnvProviderAuditHost): string | null {
  try {
    const pluginId = host.event.getPluginId();
    return pluginId || null;
  } catch {
    return null;
  }
}

export function buildEnvProviderFailure(
  error: unknown,
): EnvProviderAuditFailure {
  if (error instanceof AuditInputError) {
    return {
      ok: false,
      errorCode: 'INVALID_INPUT',
      message: error.message,
      recommendations: [
        'Provide empty input for defaults, or JSON like {"envTypes":["node","python"],"notifyOnIssues":true}.',
        'Ensure envTypes is a non-empty string array.',
      ],
    };
  }

  return {
    ok: false,
    errorCode: 'HOST_CALL_FAILED',
    message:
      error instanceof Error
        ? error.message
        : 'Environment provider audit failed.',
    recommendations: [
      'Verify env_read and notification permissions in plugin.toml.',
      'Retry after checking provider availability in the host runtime.',
    ],
  };
}
