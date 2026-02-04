# Custom Detection API Reference

## 1. Core Summary

Custom Detection System provides 20+ Tauri commands for managing detection rules, testing patterns, and performing version detection with 9 extraction strategies (regex, json_path, toml_path, yaml_path, xml_path, plain_text, tool_versions, ini_key, command).

## 2. Source of Truth

- **Backend Manager:** `src-tauri/src/core/custom_detection.rs` - Core detection logic and rule management
- **Backend Commands:** `src-tauri/src/commands/custom_detection.rs` - All Tauri command handlers
- **Frontend Types:** `lib/tauri.ts:1008-1150` - TypeScript interfaces and command wrappers
- **Integration:** `src-tauri/src/lib.rs:277-292` - Command registration
- **Preset Rules:** `src-tauri/src/core/custom_detection.rs:655-816` - Built-in rule templates

## 3. Extraction Strategies

**regex:** Pattern with named capture group "version" or first capture group. Supports multiline mode.

**json_path:** Dot-notation path (e.g., "engines.node") in JSON files.

**toml_path:** Dot-notation path (e.g., "tool.python.version") in TOML files.

**yaml_path:** Dot-notation path (e.g., "runtime.version") in YAML files.

**xml_path:** Tag path (e.g., "project.properties.java.version") in XML files.

**plain_text:** Entire file content with optional prefix/suffix stripping.

**tool_versions:** asdf-style .tool-versions format with tool name.

**ini_key:** INI/properties file with optional section and key name.

**command:** Execute command and extract version from output using regex pattern.

## 4. Key Commands

**CRUD:** `custom_rule_list`, `custom_rule_get`, `custom_rule_add`, `custom_rule_update`, `custom_rule_delete`, `custom_rule_toggle`

**Detection:** `custom_rule_detect`, `custom_rule_detect_all`, `custom_rule_list_by_env`

**Testing:** `custom_rule_test`, `custom_rule_validate_regex`, `custom_rule_extraction_types`

**Presets:** `custom_rule_presets`, `custom_rule_import_presets`

**Import/Export:** `custom_rule_export`, `custom_rule_import`
