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
