# Auto Version Detection Reference

## 1. Core Summary

Automatic version detection from project files and system executables with custom detection rules support.

## 2. Source of Truth

- **Provider Traits:** `src-tauri/src/provider/traits.rs:274-296` - EnvironmentProvider trait with detect_version()
- **System Detection:** `src-tauri/src/provider/traits.rs:182-272` - Executable-based version detection
- **Custom Detection:** `src-tauri/src/core/custom_detection.rs` - User-defined detection rules
- **Frontend Hook:** `lib/hooks/use-auto-version.ts` - Auto version detection and switching

## 3. Detection Sources

**Local Files:** `.nvmrc`, `.python-version`, `.ruby-version`, `.java-version`, `.go-version`, `rust-toolchain.toml`
**Manifests:** `package.json` (engines), `pyproject.toml`, `Gemfile`, `pom.xml`, `.sdkmanrc`, `.tool-versions`
**System Executable:** `src-tauri/src/provider/traits.rs:188-221` - Direct executable version detection (NODE_DETECTOR, PYTHON_DETECTOR, GO_DETECTOR, RUST_DETECTOR, RUBY_DETECTOR, JAVA_DETECTOR)
**Custom Rules:** User-defined regex, JSONPath, TOML, YAML, XML patterns

## 4. Provider Implementation

Each environment provider implements `detect_version()` walking up directory tree:
1. Check local version files (highest priority)
2. Check manifest files
3. Fall back to system executable detection via `system_detection::detect_from_executable()`
4. Fall back to current provider version

## 5. Custom Detection

Users can define detection rules via `src-tauri/src/commands/custom_detection.rs` with 9 extraction strategies: regex, json_path, toml_path, yaml_path, xml_path, plain_text, tool_versions, ini_key, command.
