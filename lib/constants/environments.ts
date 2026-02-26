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
    { id: 'uv', name: 'uv', description: 'Fast Python version & package manager by Astral' },
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
    { id: 'adoptium', name: 'Adoptium', description: 'Eclipse Temurin JDK Manager (Cross-platform)' },
    { id: 'sdkman', name: 'SDKMAN!', description: 'Software Development Kit Manager (macOS/Linux)' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager (cross-platform)' },
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
    { id: 'system-c', name: 'System C', description: 'System-installed C compiler (gcc/cc)' },
    { id: 'vcpkg', name: 'vcpkg', description: 'C/C++ package manager by Microsoft' },
    { id: 'conan', name: 'Conan', description: 'C/C++ package manager' },
    { id: 'msvc', name: 'MSVC', description: 'Visual Studio Build Tools detection' },
    { id: 'msys2', name: 'MSYS2', description: 'MSYS2 pacman package manager (Windows)' },
  ],
  cpp: [
    { id: 'system-cpp', name: 'System C++', description: 'System-installed C++ compiler (g++/c++)' },
    { id: 'vcpkg', name: 'vcpkg', description: 'C/C++ package manager by Microsoft' },
    { id: 'conan', name: 'Conan', description: 'C/C++ package manager' },
    { id: 'xmake', name: 'xmake', description: 'Cross-platform C/C++ build utility' },
    { id: 'msvc', name: 'MSVC', description: 'Visual Studio Build Tools detection' },
    { id: 'msys2', name: 'MSYS2', description: 'MSYS2 pacman package manager (Windows)' },
  ],
  typescript: [
    { id: 'npm', name: 'npm', description: 'Node.js package manager' },
    { id: 'pnpm', name: 'pnpm', description: 'Fast, disk space efficient package manager' },
    { id: 'yarn', name: 'Yarn', description: 'Fast, reliable dependency management' },
  ],
  scala: [
    { id: 'sdkman-scala', name: 'SDKMAN!', description: 'Scala via SDKMAN!' },
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
    { id: 'luarocks', name: 'LuaRocks', description: 'Lua package manager for rocks' },
    { id: 'asdf', name: 'asdf', description: 'Extendable version manager' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  swift: [
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  zig: [
    { id: 'zig', name: 'Zig', description: 'Direct Zig version management via ziglang.org' },
    { id: 'mise', name: 'mise', description: 'Polyglot version manager' },
  ],
  dart: [
    { id: 'fvm', name: 'FVM', description: 'Flutter Version Manager for Dart/Flutter SDK' },
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
  node: ['.nvmrc', '.node-version', '.tool-versions', 'package.json (volta.node)', 'package.json (engines.node)', 'mise.toml'],
  python: [
    '.python-version',
    'pyproject.toml (project.requires-python)',
    'pyproject.toml (tool.poetry.dependencies.python)',
    'uv.toml (requires-python)',
    'Pipfile (requires.python_version)',
    'runtime.txt',
    '.tool-versions',
    'mise.toml',
  ],
  go: ['go.mod (toolchain)', 'go.mod (go)', '.go-version', '.tool-versions', 'mise.toml'],
  rust: ['rust-toolchain', 'rust-toolchain.toml', 'Cargo.toml (rust-version)', '.tool-versions', 'mise.toml'],
  ruby: ['.ruby-version', 'Gemfile', '.tool-versions', 'mise.toml'],
  java: ['.java-version', '.sdkmanrc', '.tool-versions', 'pom.xml (java.version)', 'build.gradle (sourceCompatibility)', 'build.gradle.kts (sourceCompatibility)', 'mise.toml'],
  kotlin: ['.kotlin-version', '.sdkmanrc', '.tool-versions', 'mise.toml'],
  php: ['.php-version', 'composer.json (require.php)', '.tool-versions', 'mise.toml'],
  dotnet: ['global.json (sdk.version)', '.tool-versions', 'mise.toml'],
  deno: ['.deno-version', '.dvmrc', '.tool-versions', 'mise.toml'],
  bun: ['.bun-version', '.tool-versions', 'package.json (engines.bun)', 'mise.toml'],
  c: ['CMakeLists.txt (CMAKE_C_STANDARD)', 'meson.build (c_std)', 'xmake.lua (set_languages c)', '.tool-versions', 'mise.toml'],
  cpp: ['CMakeLists.txt (CMAKE_CXX_STANDARD)', 'meson.build (cpp_std)', 'xmake.lua (set_languages c++)', '.tool-versions', 'mise.toml'],
  typescript: ['tsconfig.json (compilerOptions.target)', '.tool-versions', 'mise.toml'],
  scala: ['build.sbt', '.scala-version', '.sdkmanrc', '.tool-versions', 'mise.toml'],
  groovy: ['.sdkmanrc', '.tool-versions', 'mise.toml'],
  elixir: ['.elixir-version', 'mix.exs (elixir)', '.tool-versions', 'mise.toml'],
  erlang: ['.erlang-version', 'rebar.config (minimum_otp_vsn)', '.tool-versions', 'mise.toml'],
  lua: ['.lua-version', '.tool-versions', 'mise.toml'],
  swift: ['.swift-version', 'Package.swift (swift-tools-version)', '.tool-versions', 'mise.toml'],
  zig: ['.zig-version', 'build.zig.zon (minimum_zig_version)', '.tool-versions', 'mise.toml'],
  dart: ['pubspec.yaml (environment.sdk)', '.fvmrc', '.dart-version', '.tool-versions', 'mise.toml'],
  julia: ['.julia-version', 'Project.toml (compat.julia)', '.tool-versions', 'mise.toml'],
  perl: ['.perl-version', 'cpanfile (perl)', '.tool-versions', 'mise.toml'],
  r: ['.Rversion', 'DESCRIPTION (R)', '.tool-versions', 'mise.toml'],
  haskell: ['stack.yaml (resolver)', 'cabal.project', '.tool-versions', 'mise.toml'],
  clojure: ['.tool-versions', 'mise.toml'],
  crystal: ['.crystal-version', 'shard.yml (crystal)', '.tool-versions', 'mise.toml'],
  nim: ['.nim-version', 'nimble (nim)', '.tool-versions', 'mise.toml'],
  ocaml: ['.ocaml-version', '.tool-versions', 'mise.toml'],
  fortran: ['.tool-versions', 'mise.toml'],
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
