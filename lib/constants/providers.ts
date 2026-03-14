/**
 * Provider category constants
 */

export const SYSTEM_PROVIDER_IDS = new Set([
  'apt', 'dnf', 'pacman', 'zypper', 'apk', 'brew', 'macports',
  'chocolatey', 'scoop', 'winget', 'flatpak', 'snap', 'wsl',
]);

export const PACKAGE_MANAGER_IDS = new Set([
  // Language ecosystem package managers
  'npm', 'pnpm', 'yarn', 'bun',
  'pip', 'uv', 'poetry', 'conda', 'pipx',
  'cargo', 'go',
  'composer', 'bundler', 'gem',
  'dotnet', 'deno', 'luarocks', 'pub',
  // General package/distribution providers
  'vcpkg', 'conan', 'xmake',
  'docker', 'podman', 'psgallery',
  // Registry/source-backed package providers
  'github', 'gitlab',
]);

/**
 * Providers that are both environment managers and package-surface providers.
 * These stay visible in package workflows even when `is_environment_provider` is true.
 */
export const DUAL_ROLE_PACKAGE_PROVIDER_IDS = new Set([
  'zig',
]);

const PACKAGE_PROVIDER_CAPABILITIES = new Set([
  'search',
  'install',
  'uninstall',
  'update',
  'upgrade',
  'list',
  'info',
]);

type ProviderCategorySource = {
  id: string;
  capabilities: string[];
  is_environment_provider?: boolean;
};

function hasPackageProviderCapabilities(provider: ProviderCategorySource): boolean {
  return provider.capabilities.some((capability) =>
    PACKAGE_PROVIDER_CAPABILITIES.has(capability.toLowerCase()),
  );
}

export function isPackageSurfaceProvider(provider: ProviderCategorySource): boolean {
  if (SYSTEM_PROVIDER_IDS.has(provider.id)) return false;
  const isDualRole = DUAL_ROLE_PACKAGE_PROVIDER_IDS.has(provider.id);
  if (provider.is_environment_provider && !isDualRole) return false;
  if (PACKAGE_MANAGER_IDS.has(provider.id)) return true;
  if (isDualRole) return true;
  return hasPackageProviderCapabilities(provider);
}

export function isPackageManagerProvider(provider: ProviderCategorySource): boolean {
  return isPackageSurfaceProvider(provider);
}

/**
 * All known provider IDs for static route generation.
 * This list must cover every provider that can appear in the system
 * so that `output: "export"` can pre-generate the `/providers/[id]` pages.
 */
export const ALL_PROVIDER_IDS = [
  // System package managers
  'apt', 'dnf', 'pacman', 'zypper', 'apk', 'brew', 'macports',
  'chocolatey', 'scoop', 'winget', 'flatpak', 'snap', 'wsl',
  'msvc', 'msys2',
  // Language package managers
  'npm', 'pnpm', 'yarn', 'bun', 'pip', 'uv', 'poetry', 'conda', 'pipx',
  'cargo', 'go', 'composer', 'bundler', 'gem', 'dotnet', 'deno',
  'luarocks', 'pub',
  // Environment / version managers
  'nvm', 'fnm', 'pyenv', 'rustup', 'goenv', 'rbenv', 'phpbrew',
  'sdkman', 'sdkman-kotlin', 'sdkman-scala', 'sdkman-groovy',
  'sdkman-gradle', 'sdkman-maven',
  'volta', 'asdf', 'mise', 'nix', 'adoptium', 'fvm', 'zig',
  // C/C++ package managers
  'vcpkg', 'conan', 'xmake',
  // Container / VCS / other
  'docker', 'podman', 'psgallery', 'github', 'gitlab', 'git',
  // System environment fallbacks
  'system-node', 'system-python', 'system-rust', 'system-go',
  'system-ruby', 'system-java', 'system-kotlin', 'system-php',
  'system-dotnet', 'system-deno', 'system-bun', 'system-zig',
  'system-dart', 'system-lua', 'system-scala', 'system-groovy',
  'system-elixir', 'system-erlang', 'system-swift', 'system-julia',
  'system-perl', 'system-r', 'system-haskell', 'system-clojure',
  'system-crystal', 'system-nim', 'system-ocaml', 'system-fortran',
  'system-c', 'system-cpp',
] as const;
