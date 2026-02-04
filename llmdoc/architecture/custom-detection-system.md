# Architecture of Custom Detection System

## 1. Identity

- **What it is:** Rust-based custom detection manager with Tauri command interface.
- **Purpose:** Provide extensible version detection system for project environments.

## 2. Core Components

- `src-tauri/src/core/custom_detection.rs` (CustomDetectionManager, CustomDetectionRule, ExtractionStrategy): Core detection engine with 9 extraction strategies and version transformation.
- `src-tauri/src/commands/custom_detection.rs` (20+ commands): Tauri IPC commands for rule CRUD operations, detection, testing, validation, import/export, and presets.
- `lib/tauri.ts` (ExtractionStrategy, VersionTransform, CustomDetectionRule, 20+ command wrappers): Frontend TypeScript types and command invokers.
- `src-tauri/src/lib.rs` (lines 13, 139, 277-292): Shared manager initialization, global state management, command registration.

## 3. Execution Flow (LLM Retrieval Map)

- **1. Initialization:** App startup creates `SharedCustomDetectionManager` in `src-tauri/src/lib.rs:139`, loads rules from `custom_detection_rules.json` in config dir.
- **2. List Rules:** Frontend calls `customRuleList` in `lib/tauri.ts:1089` → `custom_rule_list` command returns all rules.
- **3. Add/Update Rule:** Frontend calls `customRuleAdd`/`customRuleUpdate` → `custom_rule_add`/`custom_rule_update` validates and persists rule.
- **4. Detect Version:** Frontend calls `customRuleDetect` → `custom_rule_detect` walks directory tree, matches file patterns, extracts version using strategy.
- **5. Test Rule:** Frontend calls `customRuleTest` → `custom_rule_test` validates rule against test path before saving.

## 4. Design Rationale

Supports 9 extraction strategies covering most version specification formats. Priority-based rule evaluation allows customizing detection order. Preset rules provide templates for common scenarios. Import/export enables rule sharing.
