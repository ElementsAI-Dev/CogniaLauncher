# Project Environment Detection Architecture

## 1. Identity

- **What it is:** Automatic project-level version detection system that scans directory trees to find pinned runtime versions.
- **Purpose:** Detect which runtime versions a project requires by parsing version files, manifest files, and polyglot version manager configs.

## 2. Core Components

- `src-tauri/src/core/project_env_detect.rs` — Main detection module (3763 lines, 80+ unit tests)
- `lib/constants/environments.ts` — Frontend detection file constants (must stay in sync with backend)

## 3. Supported Languages (31)

node, python, go, rust, ruby, java, kotlin, scala, php, dotnet, deno, bun, zig, dart, lua, groovy, elixir, erlang, swift, julia, perl, r, haskell, c, cpp, typescript, clojure, crystal, nim, ocaml, fortran

## 4. Detection Algorithm

```
detect_env_version(env_type, start_path, sources_in_priority):
  1. Normalize start_path (file → parent dir)
  2. For current = start_path; current != root; current = parent:
     a. For each source in sources_in_priority:
        - If source file exists in current dir AND contains version info:
          → Return DetectedEnvironment { env_type, version, source, source_path }
  3. Return None (no version found)
```

**Key properties:**
- Nearest directory wins (child overrides parent)
- Within a directory, first matching source in priority list wins
- Sources are user-configurable; `default_detection_sources()` provides defaults
- `default_enabled_detection_sources()` returns first 2 as initial enabled set

## 5. Detection Source Types

### Simple Version Files
Plain text files with a single version string. Comment lines (starting with `#`) and blank lines are skipped.

| Source | Languages | Example |
|--------|-----------|---------|
| `.nvmrc` | node | `20.11.0` |
| `.node-version` | node | `18.19.0` |
| `.python-version` | python | `3.12.1` |
| `.go-version` | go | `1.22.1` |
| `.ruby-version` | ruby | `3.2.2` |
| `.java-version` | java | `21` |
| `.kotlin-version` | kotlin | `2.0.0` |
| `.scala-version` | scala | `3.3.1` |
| `.php-version` | php | `8.3.0` |
| `.deno-version` | deno | `1.40.0` |
| `.dvmrc` | deno | `1.40.0` |
| `.bun-version` | bun | `1.1.0` |
| `.zig-version` | zig | `0.13.0` |
| `.dart-version` | dart | `3.3.0` |
| `.lua-version` | lua | `5.4.6` |
| `.elixir-version` | elixir | `1.17.0` |
| `.erlang-version` | erlang | `26` |
| `.swift-version` | swift | `5.10` |
| `.julia-version` | julia | `1.10.0` |
| `.perl-version` | perl | `5.38.0` |
| `.Rversion` | r | `4.3.0` |
| `.crystal-version` | crystal | `1.12.0` |
| `.nim-version` | nim | `2.0.0` |
| `.ocaml-version` | ocaml | `5.1.0` |

### Polyglot Version Manager Files
| Source | Format | Parser |
|--------|--------|--------|
| `.tool-versions` | `<tool> <version>` per line (asdf format) | `read_tool_versions()` — matches tool name aliases |
| `mise.toml` / `.mise.toml` | TOML `[tools]` section | `read_mise_toml()` — handles string, array, table formats |
| `.sdkmanrc` | `<candidate>=<version>` per line | `read_sdkmanrc_version()` — filters by candidate key |

### Manifest/Config File Parsers (language-specific)

| Source | Language | Parser | Format |
|--------|----------|--------|--------|
| `package.json (volta.node)` | node | JSON path traversal | `{"volta": {"node": "20.0.0"}}` |
| `package.json (engines.node)` | node | JSON path traversal | `{"engines": {"node": ">=18"}}` |
| `package.json (engines.bun)` | bun | JSON path traversal | `{"engines": {"bun": ">=1.0"}}` |
| `pyproject.toml (project.requires-python)` | python | TOML | PEP 621 `requires-python` |
| `pyproject.toml (tool.poetry.dependencies.python)` | python | TOML | Poetry python constraint |
| `uv.toml (requires-python)` | python | TOML | uv config |
| `Pipfile (requires.python_version)` | python | TOML | Pipfile `[requires]` |
| `runtime.txt` | python | Plain text | `python-3.12.0` (Heroku) |
| `go.mod (toolchain)` | go | Line-based | `toolchain go1.22.1` |
| `go.mod (go)` | go | Line-based | `go 1.21.0` |
| `rust-toolchain` | rust | TOML or plain text | `nightly` or `[toolchain]\nchannel = "stable"` |
| `rust-toolchain.toml` | rust | TOML | `[toolchain]\nchannel = "1.80"` |
| `Cargo.toml (rust-version)` | rust | TOML | `[package]\nrust-version = "1.70"` |
| `Gemfile` | ruby | Line-based regex | `ruby "3.2.2"` |
| `pom.xml (java.version)` | java | XML regex (delegates to sdkman) | `<java.version>17</java.version>` |
| `build.gradle (sourceCompatibility)` | java | Regex (delegates to sdkman) | `sourceCompatibility = '17'` |
| `build.sbt` | scala | Regex | `scalaVersion := "3.3.1"` |
| `composer.json (require.php)` | php | JSON | `{"require": {"php": ">=8.1"}}` |
| `global.json (sdk.version)` | dotnet | JSON | `{"sdk": {"version": "8.0.100"}}` |
| `build.zig.zon (minimum_zig_version)` | zig | Regex (ZON format) | `.minimum_zig_version = "0.13.0"` |
| `pubspec.yaml (environment.sdk)` | dart | YAML | `environment:\n  sdk: ">=3.0.0 <4.0.0"` |
| `.fvmrc` | dart | JSON (delegates to fvm) | `{"flutter": "3.19.0"}` |
| `mix.exs (elixir)` | elixir | Regex | `elixir: "~> 1.17"` |
| `rebar.config (minimum_otp_vsn)` | erlang | Regex (Erlang term) | `{minimum_otp_vsn, "25"}` |
| `Package.swift (swift-tools-version)` | swift | Regex | `// swift-tools-version: 5.10` |
| `Project.toml (compat.julia)` | julia | TOML | `[compat]\njulia = "1.10"` |
| `cpanfile (perl)` | perl | Regex | `requires 'perl', '>= 5.026'` |
| `DESCRIPTION (R)` | r | Regex (DCF format) | `Depends: R (>= 4.0.0)` |
| `stack.yaml (resolver)` | haskell | YAML | `snapshot: lts-22.7` (prefers `snapshot` over `resolver`) |
| `cabal.project` | haskell | Regex | `with-compiler: ghc-9.6.3` |
| `shard.yml (crystal)` | crystal | YAML | `crystal: "1.12.0"` |
| `nimble (nim)` | nim | Regex (scans *.nimble) | `requires "nim >= 2.0.0"` |
| `CMakeLists.txt (CMAKE_C_STANDARD)` | c | Regex | `set(CMAKE_C_STANDARD 17)` |
| `CMakeLists.txt (CMAKE_CXX_STANDARD)` | cpp | Regex | `set(CMAKE_CXX_STANDARD 20)` |
| `tsconfig.json (compilerOptions.target)` | typescript | Regex (JSONC-safe) | `"target": "ES2022"` |

## 6. Frontend/Backend Parity Contract

The comment in `project_env_detect.rs` states:
> These labels MUST match frontend `DEFAULT_DETECTION_FILES`

Both `default_detection_sources()` (Rust) and `DEFAULT_DETECTION_FILES` (TypeScript) must list the same sources in the same order for each language. This is critical for settings UI to display correct detection file options.

## 7. Test Coverage

80+ unit tests in the `#[cfg(test)] mod tests` section covering:
- All 31 language detection functions
- Priority ordering (version file > mise.toml)
- Directory traversal (child overrides parent)
- Edge cases (empty files, comments, whitespace, v-prefix)
- All manifest parser variants (TOML, JSON, YAML, regex)
- mise.toml format variants (string, array, table)
- `.mise.toml` preferred over `mise.toml`

## 8. Related Documentation

- [Auto Version Detection Reference](../reference/auto-version-detection.md)
- [Custom Detection System](../architecture/custom-detection-system.md)
- [Provider System Architecture](../architecture/provider-system.md)
