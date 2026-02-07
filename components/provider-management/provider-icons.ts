export const PROVIDER_ICONS: Record<string, string> = {
  npm: "📦",
  pnpm: "⚡",
  uv: "🐍",
  cargo: "🦀",
  chocolatey: "🍫",
  scoop: "🥄",
  winget: "🪟",
  brew: "🍺",
  apt: "🐧",
  dnf: "🎩",
  pacman: "👻",
  zypper: "🦎",
  apk: "🏔️",
  vcpkg: "📚",
  docker: "🐳",
  podman: "🦭",
  psgallery: "💠",
  github: "🐙",
  nvm: "💚",
  fnm: "⚡",
  pyenv: "🐍",
  rustup: "🦀",
  goenv: "🔵",
  flatpak: "📦",
  snap: "🔶",
  macports: "🚢",
  pip: "🐍",
  yarn: "🧶",
  bun: "🍞",
  poetry: "📜",
  composer: "🎵",
  bundler: "💎",
  gem: "💎",
  dotnet: "🟣",
  conda: "🐍",
  pipx: "🐍",
  volta: "⚡",
  asdf: "🔧",
  mise: "🔧",
  nix: "❄️",
  conan: "📚",
  xmake: "📚",
  sdkman: "☕",
  "sdkman-kotlin": "🟣",
  rbenv: "💎",
  phpbrew: "🐘",
  deno: "🦕",
  wsl: "🐧",
};

export const PLATFORM_ICONS: Record<string, string> = {
  windows: "🪟",
  linux: "🐧",
  macos: "🍎",
  darwin: "🍎",
};

export const CAPABILITY_COLORS: Record<string, string> = {
  install: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  uninstall: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  search: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  update: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  list: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  upgrade: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  update_index: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-300",
  version_switch: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  multi_version: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  lock_version: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
  rollback: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  project_local: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
};

export function getProviderIcon(providerId: string): string {
  return PROVIDER_ICONS[providerId] || "📦";
}

export function getPlatformIcon(platform: string): string {
  return PLATFORM_ICONS[platform.toLowerCase()] || "💻";
}

export function getCapabilityColor(capability: string): string {
  return (
    CAPABILITY_COLORS[capability] ||
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  );
}
