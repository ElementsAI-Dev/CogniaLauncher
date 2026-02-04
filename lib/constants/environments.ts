/**
 * Environment-related constants
 */

// Supported programming languages with their display information
export const LANGUAGES = [
  { id: 'node', name: 'Node.js', icon: '🟢', color: 'bg-green-50 border-green-500' },
  { id: 'deno', name: 'Deno', icon: '🦕', color: 'bg-teal-50 border-teal-500' },
  { id: 'python', name: 'Python', icon: '🐍', color: 'bg-blue-50 border-blue-500' },
  { id: 'go', name: 'Go', icon: '🔵', color: 'bg-cyan-50 border-cyan-500' },
  { id: 'rust', name: 'Rust', icon: '🦀', color: 'bg-orange-50 border-orange-500' },
  { id: 'ruby', name: 'Ruby', icon: '💎', color: 'bg-red-50 border-red-500' },
  { id: 'java', name: 'Java', icon: '☕', color: 'bg-amber-50 border-amber-500' },
  { id: 'php', name: 'PHP', icon: '🐘', color: 'bg-purple-50 border-purple-500' },
  { id: 'dotnet', name: '.NET', icon: '🔷', color: 'bg-violet-50 border-violet-500' },
] as const;

export type LanguageId = typeof LANGUAGES[number]['id'];

// Default version managers/providers for each language (fallback when dynamic discovery fails)
export const DEFAULT_PROVIDERS: Record<string, { id: string; name: string; description: string }[]> = {
  node: [
    { id: 'fnm', name: 'fnm', description: 'Fast Node Manager (Recommended)' },
    { id: 'nvm', name: 'nvm', description: 'Node Version Manager' },
  ],
  deno: [
    { id: 'deno', name: 'Deno', description: 'Deno runtime (built-in version management)' },
  ],
  python: [
    { id: 'pyenv', name: 'pyenv', description: 'Python version management' },
  ],
  go: [
    { id: 'goenv', name: 'goenv', description: 'Go version management' },
  ],
  rust: [
    { id: 'rustup', name: 'rustup', description: 'Rust toolchain installer' },
  ],
  ruby: [
    { id: 'rbenv', name: 'rbenv', description: 'Ruby version management' },
  ],
  java: [
    { id: 'sdkman', name: 'SDKMAN!', description: 'Software Development Kit Manager' },
  ],
  php: [
    { id: 'phpbrew', name: 'phpbrew', description: 'PHP version manager' },
  ],
  dotnet: [
    { id: 'dotnet', name: 'dotnet', description: '.NET SDK' },
  ],
};

// Default detection files for automatic version detection per environment type
export const DEFAULT_DETECTION_FILES: Record<string, string[]> = {
  node: ['.nvmrc', '.node-version', 'package.json (engines.node)', '.tool-versions'],
  deno: ['.deno-version', '.dvmrc', 'deno.json', '.tool-versions'],
  python: ['.python-version', 'pyproject.toml', '.tool-versions', 'runtime.txt'],
  go: ['.go-version', 'go.mod', '.tool-versions'],
  rust: ['rust-toolchain.toml', 'rust-toolchain', '.tool-versions'],
  ruby: ['.ruby-version', 'Gemfile', '.tool-versions'],
  java: ['.java-version', 'pom.xml', '.tool-versions', '.sdkmanrc'],
  php: ['.php-version', 'composer.json (require.php)', '.tool-versions'],
  dotnet: ['global.json', '.tool-versions'],
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
