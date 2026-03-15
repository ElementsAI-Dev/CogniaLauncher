export type EnvironmentWorkflowOrigin =
  | "dashboard"
  | "overview"
  | "detail"
  | "onboarding"
  | "direct";

export type EnvironmentWorkflowActionKind =
  | "install"
  | "uninstall"
  | "setGlobal"
  | "setLocal"
  | "refresh"
  | "saveSettings"
  | "applyProfile"
  | "createShim"
  | "removeShim"
  | "regenerateShims"
  | "setupPath"
  | "removePath";

export type EnvironmentWorkflowActionStatus =
  | "running"
  | "success"
  | "error"
  | "blocked";

export interface EnvironmentWorkflowContext {
  envType: string;
  origin: EnvironmentWorkflowOrigin;
  returnHref?: string | null;
  projectPath?: string | null;
  providerId?: string | null;
  updatedAt: number;
}

export interface EnvironmentWorkflowAction {
  envType: string;
  action: EnvironmentWorkflowActionKind;
  status: EnvironmentWorkflowActionStatus;
  version?: string | null;
  providerId?: string | null;
  projectPath?: string | null;
  error?: string | null;
  retryable?: boolean;
  updatedAt: number;
}

export interface ProviderAlias {
  id: string;
  env_type: string;
}

export const PROVIDER_ENV_TYPE_MAP: Record<string, string> = {
  fnm: "node",
  nvm: "node",
  volta: "node",
  deno: "deno",
  pyenv: "python",
  conda: "python",
  pipx: "python",
  goenv: "go",
  rustup: "rust",
  rbenv: "ruby",
  sdkman: "java",
  phpbrew: "php",
  dotnet: "dotnet",
  mise: "polyglot",
  asdf: "polyglot",
  nix: "polyglot",
  "system-node": "node",
  "system-python": "python",
  "system-go": "go",
  "system-rust": "rust",
  "system-ruby": "ruby",
  "system-java": "java",
  "system-php": "php",
  "system-dotnet": "dotnet",
  "system-deno": "deno",
  "system-bun": "bun",
  "system-c": "c",
  "system-cpp": "cpp",
  msvc: "cpp",
  msys2: "cpp",
  vcpkg: "cpp",
  conan: "cpp",
  xmake: "cpp",
  "sdkman-kotlin": "kotlin",
  "sdkman-scala": "scala",
  "sdkman-gradle": "java",
  "sdkman-maven": "java",
  "system-kotlin": "kotlin",
};

export function normalizeEnvType(envType: string): string {
  return envType.trim().toLowerCase();
}

export function normalizeProviderId(providerId?: string | null): string {
  return (providerId ?? "").trim().toLowerCase();
}

export function normalizeProviderAliases(providers: ProviderAlias[]): ProviderAlias[] {
  return providers.map((provider) => ({
    id: normalizeEnvType(provider.id),
    env_type: normalizeEnvType(provider.env_type),
  }));
}

export function getLogicalEnvType(
  providerEnvType: string,
  availableProviders?: ProviderAlias[],
): string {
  const normalizedProviderEnvType = normalizeEnvType(providerEnvType);
  const providerInfo = availableProviders?.find(
    (provider) => normalizeEnvType(provider.id) === normalizedProviderEnvType,
  );

  if (providerInfo) {
    return normalizeEnvType(providerInfo.env_type);
  }

  return PROVIDER_ENV_TYPE_MAP[normalizedProviderEnvType] || normalizedProviderEnvType;
}

export function resolveLogicalEnvSettingsType(
  envType: string,
  availableProviders: ProviderAlias[],
): string {
  const normalizedEnvType = normalizeEnvType(envType);
  return normalizeEnvType(
    getLogicalEnvType(normalizedEnvType, normalizeProviderAliases(availableProviders)),
  );
}

export function isProviderCompatible(
  providerId: string,
  logicalEnvType: string,
  availableProviders: ProviderAlias[],
): boolean {
  const normalizedProviderId = normalizeEnvType(providerId);
  return normalizeProviderAliases(availableProviders).some(
    (provider) =>
      provider.id === normalizedProviderId &&
      provider.env_type === normalizeEnvType(logicalEnvType),
  );
}

export function resolveWorkflowProviderSelection({
  envType,
  selectedProviders,
  availableProviders,
  fallbackProviderId,
}: {
  envType: string;
  selectedProviders: Record<string, string>;
  availableProviders: ProviderAlias[];
  fallbackProviderId?: string | null;
}): string {
  const logicalEnvType = resolveLogicalEnvSettingsType(envType, availableProviders);
  const selectedProviderId = selectedProviders[logicalEnvType];

  if (
    selectedProviderId &&
    isProviderCompatible(selectedProviderId, logicalEnvType, availableProviders)
  ) {
    return normalizeEnvType(selectedProviderId);
  }

  if (
    fallbackProviderId &&
    isProviderCompatible(fallbackProviderId, logicalEnvType, availableProviders)
  ) {
    return normalizeEnvType(fallbackProviderId);
  }

  const firstMatchingProvider = normalizeProviderAliases(availableProviders).find(
    (provider) => provider.env_type === logicalEnvType,
  );

  return firstMatchingProvider?.id ?? normalizeEnvType(fallbackProviderId || logicalEnvType);
}

export function pruneWorkflowSelectedProviders(
  selectedProviders: Record<string, string>,
  availableProviders: ProviderAlias[],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(selectedProviders).filter(([logicalEnvType, providerId]) =>
      isProviderCompatible(providerId, logicalEnvType, availableProviders),
    ),
  );
}

export function createBlockedWorkflowAction({
  envType,
  action,
  availableProviders,
  providerId,
  projectPath,
  reason,
  version,
}: {
  envType: string;
  action: EnvironmentWorkflowActionKind;
  availableProviders: ProviderAlias[];
  providerId?: string | null;
  projectPath?: string | null;
  reason: string;
  version?: string | null;
}): EnvironmentWorkflowAction {
  return {
    envType: resolveLogicalEnvSettingsType(envType, availableProviders),
    action,
    status: "blocked",
    version: version ?? null,
    providerId: providerId ? normalizeEnvType(providerId) : null,
    projectPath: projectPath ?? null,
    error: reason,
    retryable: false,
    updatedAt: Date.now(),
  };
}
