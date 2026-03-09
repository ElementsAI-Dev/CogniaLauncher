import { cognia } from '@cognia/plugin-sdk';

type PackageUpdateAdvisorInput = {
  provider?: string;
  packages?: string[];
  limit?: number;
  copySummary?: boolean;
  notifyOnUpdates?: boolean;
  emitEvent?: boolean;
};

type PackageUpdateAdvisorSuccess = {
  ok: true;
  provider: string;
  targetPackages: string[];
  totalInstalled: number;
  updateCount: number;
  updates: ReturnType<typeof cognia.pkg.checkUpdates>;
  summary: string;
  recommendations: string[];
  message: string;
};

type PackageUpdateAdvisorFailure = {
  ok: false;
  errorCode: 'INVALID_INPUT' | 'HOST_CALL_FAILED';
  message: string;
  recommendations: string[];
};

const DEFAULT_PROVIDER = 'npm';
const DEFAULT_LIMIT = 30;

class AdvisorInputError extends Error {
  readonly code = 'INVALID_INPUT' as const;
}

function pkg_update_advisor(): number {
  const raw = Host.inputString();
  try {
    const input = parseInput(raw);
    const result = runAdvisor(input);
    Host.outputString(JSON.stringify(result));
    return 0;
  } catch (error) {
    Host.outputString(JSON.stringify(buildFailure(error)));
    return 1;
  }
}

function parseInput(raw: string): Required<PackageUpdateAdvisorInput> {
  if (!raw.trim()) {
    return {
      provider: DEFAULT_PROVIDER,
      packages: [],
      limit: DEFAULT_LIMIT,
      copySummary: false,
      notifyOnUpdates: false,
      emitEvent: true,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AdvisorInputError('Input must be valid JSON when provided.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AdvisorInputError('Input must be a JSON object.');
  }

  const candidate = parsed as PackageUpdateAdvisorInput;
  const provider = normalizeProvider(candidate.provider);
  const packages = normalizePackages(candidate.packages);
  const limit = normalizeLimit(candidate.limit);

  return {
    provider,
    packages,
    limit,
    copySummary: normalizeBoolean(candidate.copySummary, false, 'copySummary'),
    notifyOnUpdates: normalizeBoolean(candidate.notifyOnUpdates, false, 'notifyOnUpdates'),
    emitEvent: normalizeBoolean(candidate.emitEvent, true, 'emitEvent'),
  };
}

function normalizeProvider(value: unknown): string {
  if (value === undefined || value === null) {
    return DEFAULT_PROVIDER;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new AdvisorInputError('provider must be a non-empty string.');
  }
  return value.trim();
}

function normalizePackages(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new AdvisorInputError('packages must be an array of strings.');
  }
  return [...new Set(
    value.map((item) => {
      if (typeof item !== 'string') {
        throw new AdvisorInputError('packages must contain only strings.');
      }
      const trimmed = item.trim();
      if (!trimmed) {
        throw new AdvisorInputError('packages cannot include empty values.');
      }
      return trimmed;
    }),
  )];
}

function normalizeLimit(value: unknown): number {
  if (value === undefined || value === null) {
    return DEFAULT_LIMIT;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 500) {
    throw new AdvisorInputError('limit must be an integer between 1 and 500.');
  }
  return parsed;
}

function normalizeBoolean(value: unknown, fallback: boolean, fieldName: string): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'boolean') {
    throw new AdvisorInputError(`${fieldName} must be a boolean value.`);
  }
  return value;
}

function runAdvisor(input: Required<PackageUpdateAdvisorInput>): PackageUpdateAdvisorSuccess {
  const installed = cognia.pkg.listInstalled(input.provider);
  const targetPackages = selectTargetPackages(installed.map((pkg) => pkg.name), input.packages, input.limit);
  const updates = targetPackages.length > 0
    ? cognia.pkg.checkUpdates(targetPackages, input.provider)
    : [];

  const summary = buildSummary(input.provider, targetPackages, updates, installed.length);
  const recommendations = buildRecommendations(targetPackages, updates);

  if (input.copySummary) {
    cognia.clipboard.write(summary);
  }
  if (input.notifyOnUpdates && updates.length > 0) {
    cognia.notification.send('Package updates available', `${updates.length} update(s) detected for provider ${input.provider}.`);
  }
  if (input.emitEvent) {
    cognia.event.emit('builtin.pkg_update_advisor.completed', {
      provider: input.provider,
      targetCount: targetPackages.length,
      updateCount: updates.length,
    });
  }

  return {
    ok: true,
    provider: input.provider,
    targetPackages,
    totalInstalled: installed.length,
    updateCount: updates.length,
    updates,
    summary,
    recommendations,
    message: updates.length > 0
      ? `Found ${updates.length} update(s) for provider ${input.provider}.`
      : `No updates detected for provider ${input.provider}.`,
  };
}

function selectTargetPackages(installedNames: string[], requested: string[], limit: number): string[] {
  const source = requested.length > 0 ? requested : installedNames;
  return [...new Set(source)].slice(0, limit);
}

function buildSummary(
  provider: string,
  targetPackages: string[],
  updates: ReturnType<typeof cognia.pkg.checkUpdates>,
  totalInstalled: number,
): string {
  const lines = [
    `Provider: ${provider}`,
    `Installed packages: ${totalInstalled}`,
    `Checked packages: ${targetPackages.length}`,
    `Available updates: ${updates.length}`,
  ];

  if (updates.length > 0) {
    lines.push('Update candidates:');
    for (const item of updates) {
      lines.push(`- ${item.name}: ${item.currentVersion} -> ${item.latestVersion}`);
    }
  }

  return lines.join('\n');
}

function buildRecommendations(
  targetPackages: string[],
  updates: ReturnType<typeof cognia.pkg.checkUpdates>,
): string[] {
  if (targetPackages.length === 0) {
    return [
      'No target packages were selected. Pass packages explicitly or ensure provider has installed packages.',
    ];
  }

  if (updates.length === 0) {
    return [
      'No updates are currently required for the selected package set.',
      'Re-run the advisor periodically to track new releases.',
    ];
  }

  return [
    'Prioritize updates with the largest current-to-latest version gap.',
    'Copy the summary and attach it to your maintenance or release ticket.',
  ];
}

function buildFailure(error: unknown): PackageUpdateAdvisorFailure {
  if (error instanceof AdvisorInputError) {
    return {
      ok: false,
      errorCode: 'INVALID_INPUT',
      message: error.message,
      recommendations: [
        'Provide empty input for auto-discovery, or JSON like {"provider":"npm","limit":20}.',
        'Ensure packages is an array of non-empty strings and limit is within range.',
      ],
    };
  }

  return {
    ok: false,
    errorCode: 'HOST_CALL_FAILED',
    message: error instanceof Error ? error.message : 'Package update advisor failed.',
    recommendations: [
      'Verify pkg_search, clipboard, and notification permissions in plugin.toml.',
      'Retry after confirming provider availability in the host runtime.',
    ],
  };
}

declare const module: { exports: unknown };

module.exports = {
  pkg_update_advisor,
  __test: {
    parseInput,
    runAdvisor,
    selectTargetPackages,
    buildSummary,
    buildRecommendations,
  },
};
