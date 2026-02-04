# How to Integrate Custom Detection Rules

1. **Create Rule Definition:** Define `CustomDetectionRule` in frontend with `id`, `name`, `env_type`, `file_patterns`, `extraction` strategy, and optional `version_transform`.

2. **Validate Rule:** Call `customRuleValidateRegex` for regex strategies to ensure pattern validity before saving.

3. **Test Rule:** Use `customRuleTest` with a test path to verify the rule extracts the expected version correctly.

4. **Add Rule:** Call `customRuleAdd` to persist the rule. The manager saves to `custom_detection_rules.json` in app config dir.

5. **Use Detection:** Call `customRuleDetect` for single environment or `customRuleDetectAll` for all environments to detect versions using custom rules.

6. **Import Presets:** Use `customRulePresets` to get built-in templates, then `customRuleImportPresets` to import selected ones.

7. **Export/Import:** Use `customRuleExport` and `customRuleImport` to backup/restore or share rules across installations.
