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
  { id: 'c', name: 'C', icon: '🔤', color: 'bg-slate-500/10 border-slate-500 dark:bg-slate-500/20' },
  { id: 'cpp', name: 'C++', icon: '⚙️', color: 'bg-blue-600/10 border-blue-600 dark:bg-blue-600/20' },
  { id: 'typescript', name: 'TypeScript', icon: '🔷', color: 'bg-blue-500/10 border-blue-500 dark:bg-blue-500/20' },
  { id: 'scala', name: 'Scala', icon: '🔴', color: 'bg-red-600/10 border-red-600 dark:bg-red-600/20' },
  { id: 'groovy', name: 'Groovy', icon: '🌟', color: 'bg-sky-500/10 border-sky-500 dark:bg-sky-500/20' },
  { id: 'elixir', name: 'Elixir', icon: '💧', color: 'bg-purple-600/10 border-purple-600 dark:bg-purple-600/20' },
  { id: 'erlang', name: 'Erlang', icon: '📡', color: 'bg-rose-600/10 border-rose-600 dark:bg-rose-600/20' },
  { id: 'lua', name: 'Lua', icon: '🌙', color: 'bg-indigo-600/10 border-indigo-600 dark:bg-indigo-600/20' },
  { id: 'swift', name: 'Swift', icon: '🐦', color: 'bg-orange-500/10 border-orange-500 dark:bg-orange-500/20' },
  { id: 'zig', name: 'Zig', icon: '⚡', color: 'bg-amber-500/10 border-amber-500 dark:bg-amber-500/20' },
  { id: 'dart', name: 'Dart', icon: '🎯', color: 'bg-cyan-600/10 border-cyan-600 dark:bg-cyan-600/20' },
  { id: 'julia', name: 'Julia', icon: '🔬', color: 'bg-violet-500/10 border-violet-500 dark:bg-violet-500/20' },
  { id: 'perl', name: 'Perl', icon: '🐪', color: 'bg-slate-600/10 border-slate-600 dark:bg-slate-600/20' },
  { id: 'r', name: 'R', icon: '📊', color: 'bg-blue-700/10 border-blue-700 dark:bg-blue-700/20' },
  { id: 'haskell', name: 'Haskell', icon: '🎩', color: 'bg-purple-500/10 border-purple-500 dark:bg-purple-500/20' },
  { id: 'clojure', name: 'Clojure', icon: '♻️', color: 'bg-emerald-600/10 border-emerald-600 dark:bg-emerald-600/20' },
  { id: 'crystal', name: 'Crystal', icon: '💠', color: 'bg-gray-600/10 border-gray-600 dark:bg-gray-600/20' },
  { id: 'nim', name: 'Nim', icon: '👑', color: 'bg-yellow-600/10 border-yellow-600 dark:bg-yellow-600/20' },
  { id: 'ocaml', name: 'OCaml', icon: '🐫', color: 'bg-orange-600/10 border-orange-600 dark:bg-orange-600/20' },
  { id: 'fortran', name: 'Fortran', icon: '🔢', color: 'bg-purple-700/10 border-purple-700 dark:bg-purple-700/20' },
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
  c: [
    { id: 'vcpkg', name: 'vcpkg', description: 'C/C++ package manager by Microsoft' },
    { id: 'conan', name: 'Conan', description: 'C/C++ package manager' },
  ],
  cpp: [
    { id: 'vcpkg', name: 'vcpkg', description: 'C/C++ package manager by Microsoft' },
    { id: 'conan', name: 'Conan', description: 'C/C++ package manager' },
    { id: 'xmake', name: 'xmake', description: 'Cross-platform C/C++ build utility' },
  ],
  typescript: [
    { id: 'npm', name: 'npm', description: 'Node.js package manager' },
    { id: 'pnpm', name: 'pnpm', description: 'Fast, disk space efficient package manager' },
    { id: 'yarn', name: 'Yarn', description: 'Fast, reliable dependency management' },
  ],
  scala: [
    { id: 'sdkman', name: 'SDKMAN!', description: 'Scala via SDKMAN!' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  groovy: [
    { id: 'sdkman', name: 'SDKMAN!', description: 'Groovy via SDKMAN!' },
  ],
  elixir: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  erlang: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  lua: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  swift: [
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  zig: [
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  dart: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  julia: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  perl: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  r: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  haskell: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  clojure: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  crystal: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  nim: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  ocaml: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  fortran: [
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
};

// Default detection files for automatic version detection per environment type
export const DEFAULT_DETECTION_FILES: Record<string, string[]> = {
  node: ['.nvmrc', '.node-version', '.tool-versions', 'package.json (volta.node)', 'package.json (engines.node)'],
  python: [
    '.python-version',
    'pyproject.toml (project.requires-python)',
    'pyproject.toml (tool.poetry.dependencies.python)',
    'Pipfile (requires.python_version)',
    'runtime.txt',
    '.tool-versions',
  ],
  go: ['go.mod (toolchain)', 'go.mod (go)', '.go-version', '.tool-versions'],
  rust: ['rust-toolchain', 'rust-toolchain.toml', '.tool-versions'],
  ruby: ['.ruby-version', 'Gemfile', '.tool-versions'],
  java: ['.java-version', '.sdkmanrc', '.tool-versions'],
  kotlin: ['.kotlin-version', '.sdkmanrc', '.tool-versions'],
  php: ['.php-version', 'composer.json (require.php)', '.tool-versions'],
  dotnet: ['global.json (sdk.version)', '.tool-versions'],
  deno: ['.deno-version', '.dvmrc', '.tool-versions'],
  bun: ['.bun-version', '.tool-versions', 'package.json (engines.bun)'],
  c: ['CMakeLists.txt', 'Makefile', 'vcpkg.json', 'conanfile.txt', 'conanfile.py', 'xmake.lua'],
  cpp: ['CMakeLists.txt', 'Makefile', 'vcpkg.json', 'conanfile.txt', 'conanfile.py', 'xmake.lua'],
  typescript: ['tsconfig.json', 'tsconfig.build.json', '.tool-versions'],
  scala: ['build.sbt', '.scala-version', '.sdkmanrc', '.tool-versions'],
  groovy: ['build.gradle', '.sdkmanrc', '.tool-versions'],
  elixir: ['mix.exs', '.elixir-version', '.tool-versions'],
  erlang: ['rebar.config', '.erlang-version', '.tool-versions'],
  lua: ['.lua-version', 'xmake.lua', '.tool-versions'],
  swift: ['Package.swift', '.swift-version', '.tool-versions'],
  zig: ['build.zig', '.zig-version', '.tool-versions'],
  dart: ['pubspec.yaml', '.dart-version', '.tool-versions'],
  julia: ['Project.toml', '.julia-version', '.tool-versions'],
  perl: ['cpanfile', '.perl-version', '.tool-versions'],
  r: ['DESCRIPTION', '.Rversion', '.tool-versions'],
  haskell: ['stack.yaml', 'cabal.project', '.tool-versions'],
  clojure: ['deps.edn', 'project.clj', '.tool-versions'],
  crystal: ['shard.yml', '.crystal-version', '.tool-versions'],
  nim: ['nimble', '.nim-version', '.tool-versions'],
  ocaml: ['dune-project', '.ocaml-version', '.tool-versions'],
  fortran: ['fpm.toml', '.tool-versions'],
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
