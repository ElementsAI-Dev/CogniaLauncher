/**
 * Environment-related constants
 */

// Supported programming languages with their display information
export const LANGUAGES = [
  { id: 'node', name: 'Node.js', icon: '🟢', color: 'bg-green-500/10 border-green-500 dark:bg-green-500/20' },
  { id: 'python', name: 'Python', icon: '🐍', color: 'bg-blue-500/10 border-blue-500 dark:bg-blue-500/20' },
  { id: 'go', name: 'Go', icon: '🔵', color: 'bg-cyan-500/10 border-cyan-500 dark:bg-cyan-500/20' },
  { id: 'rust', name: 'Rust', icon: '🦀', color: 'bg-orange-500/10 border-orange-500 dark:bg-orange-500/20' },
  { id: 'ruby', name: 'Ruby', icon: '💎', color: 'bg-red-500/10 border-red-500 dark:bg-red-500/20' },
  { id: 'java', name: 'Java', icon: '☕', color: 'bg-amber-500/10 border-amber-500 dark:bg-amber-500/20' },
  { id: 'kotlin', name: 'Kotlin', icon: '🟣', color: 'bg-indigo-500/10 border-indigo-500 dark:bg-indigo-500/20' },
  { id: 'php', name: 'PHP', icon: '🐘', color: 'bg-purple-500/10 border-purple-500 dark:bg-purple-500/20' },
  { id: 'dotnet', name: '.NET', icon: '🔷', color: 'bg-violet-500/10 border-violet-500 dark:bg-violet-500/20' },
  { id: 'deno', name: 'Deno', icon: '🦕', color: 'bg-teal-500/10 border-teal-500 dark:bg-teal-500/20' },
  { id: 'bun', name: 'Bun', icon: '🧅', color: 'bg-yellow-500/10 border-yellow-500 dark:bg-yellow-500/20' },
] as const;

export type LanguageId = typeof LANGUAGES[number]['id'];

// Default version managers/providers for each language (fallback when dynamic discovery fails)
export const DEFAULT_PROVIDERS: Record<string, { id: string; name: string; description: string }[]> = {
  node: [
    { id: 'volta', name: 'Volta', description: 'Hassle-free JavaScript tool manager (Recommended)' },
    { id: 'fnm', name: 'fnm', description: 'Fast Node Manager, built in Rust' },
    { id: 'nvm', name: 'nvm', description: 'Node Version Manager' },
  ],
  python: [
    { id: 'pyenv', name: 'pyenv', description: 'Python version management' },
    { id: 'conda', name: 'Conda', description: 'Anaconda/Miniconda environment manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager (formerly rtx)' },
  ],
  go: [
    { id: 'goenv', name: 'goenv', description: 'Go version management' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager (formerly rtx)' },
  ],
  rust: [
    { id: 'rustup', name: 'rustup', description: 'Rust toolchain installer' },
  ],
  ruby: [
    { id: 'rbenv', name: 'rbenv', description: 'Ruby version management' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager (formerly rtx)' },
  ],
  java: [
    { id: 'sdkman', name: 'SDKMAN!', description: 'Software Development Kit Manager' },
  ],
  kotlin: [
    { id: 'sdkman-kotlin', name: 'SDKMAN!', description: 'Kotlin compiler via SDKMAN!' },
  ],
  php: [
    { id: 'phpbrew', name: 'phpbrew', description: 'PHP version manager' },
  ],
  dotnet: [
    { id: 'dotnet', name: 'dotnet', description: '.NET SDK' },
  ],
  deno: [
    { id: 'deno', name: 'Deno', description: 'Deno runtime version manager' },
  ],
  bun: [
    { id: 'system-bun', name: 'System Bun', description: 'System-installed Bun runtime' },
  ],
};

// Default detection files for automatic version detection per environment type
export const DEFAULT_DETECTION_FILES: Record<string, string[]> = {
  node: ['.nvmrc', '.node-version', 'package.json (engines.node)', '.tool-versions'],
  deno: ['.deno-version', '.dvmrc', 'deno.json', '.tool-versions'],
  python: ['.python-version', 'pyproject.toml', '.tool-versions', 'runtime.txt', 'uv.lock', 'rye.lock', 'environment.yml'],
  go: ['.go-version', 'go.mod', '.tool-versions'],
  rust: ['rust-toolchain.toml', 'rust-toolchain', '.tool-versions'],
  ruby: ['.ruby-version', 'Gemfile', '.tool-versions'],
  java: ['.java-version', 'pom.xml', 'build.gradle', 'build.gradle.kts', '.tool-versions', '.sdkmanrc'],
  kotlin: ['.kotlin-version', 'build.gradle.kts', 'build.gradle', '.tool-versions', '.sdkmanrc'],
  php: ['.php-version', 'composer.json (require.php)', '.tool-versions'],
  dotnet: ['global.json', '.tool-versions'],
  bun: ['bunfig.toml', 'package.json (engines.bun)', '.tool-versions'],
};

// Version filter options
export const VERSION_FILTERS = ['all', 'stable', 'lts', 'latest'] as const;
export type VersionFilter = typeof VERSION_FILTERS[number];

// Installation step names
export const INSTALLATION_STEPS = [
  'fetching',
  'downloading', 
  'extracting', 
  'configuring', 
  'done', 
  'error'
] as const;
export type InstallationStep = typeof INSTALLATION_STEPS[number];
