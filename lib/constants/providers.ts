/**
 * Provider category constants
 */

export const SYSTEM_PROVIDER_IDS = new Set([
  'apt', 'dnf', 'pacman', 'zypper', 'apk', 'brew', 'macports',
  'chocolatey', 'scoop', 'winget', 'flatpak', 'snap', 'wsl',
]);

export const PACKAGE_MANAGER_IDS = new Set([
  'npm', 'pnpm', 'yarn', 'pip', 'uv', 'cargo', 'vcpkg', 'docker', 'podman', 'psgallery', 'github',
]);

/**
 * All known provider IDs for static route generation.
 * This list must cover every provider that can appear in the system
 * so that `output: "export"` can pre-generate the `/providers/[id]` pages.
 */
export const ALL_PROVIDER_IDS = [
  // System package managers
  'apt', 'dnf', 'pacman', 'zypper', 'apk', 'brew', 'macports',
  'chocolatey', 'scoop', 'winget', 'flatpak', 'snap', 'wsl',
  // Language package managers
  'npm', 'pnpm', 'yarn', 'bun', 'pip', 'uv', 'poetry', 'conda', 'pipx',
  'cargo', 'go', 'composer', 'bundler', 'gem', 'dotnet', 'deno',
  // Environment / version managers
  'nvm', 'fnm', 'pyenv', 'rustup', 'goenv', 'rbenv', 'phpbrew',
  'sdkman', 'sdkman-kotlin', 'volta', 'asdf', 'mise', 'nix',
  // C/C++ package managers
  'vcpkg', 'conan', 'xmake',
  // Container / other
  'docker', 'podman', 'psgallery', 'github', 'gitlab',
  // System environment fallbacks
  'system-node', 'system-python', 'system-rust', 'system-go',
  'system-ruby', 'system-java', 'system-kotlin', 'system-php',
  'system-dotnet', 'system-deno', 'system-bun',
] as const;
