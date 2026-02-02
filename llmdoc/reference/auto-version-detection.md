# Auto Version Detection Reference

## 1. Core Summary

Automatic version detection and switching based on project configuration files (.nvmrc, .python-version, rust-toolchain.toml, etc.) with polling support.

## 2. Source of Truth

- **Primary Hook:** `lib/hooks/use-auto-version.ts` - Auto version detection logic
- **Project Path:** `lib/hooks/use-auto-version.ts:121-131` - Project path management (placeholder)
- **Detection:** `lib/hooks/use-auto-version.ts:35-76` - Version check and switch logic
- **Polling:** `lib/hooks/use-auto-version.ts:78-99` - Interval-based checking
- **Tests:** `lib/hooks/__tests__/use-auto-version.test.ts` - Detection behavior tests

## 3. Supported Version Files

**Node.js:** `.nvmrc`, `.node-version`, `package.json` (engines.field)
**Python:** `.python-version`, `pyproject.toml`, `requirements.txt`
**Rust:** `rust-toolchain.toml`
**Go:** `.go-version`, `go.mod`

## 4. Configuration

Options per `lib/hooks/use-auto-version.ts:8-12`:
- `projectPath` - Path to project directory
- `enabled` - Enable/disable auto-switch (default: true)
- `pollInterval` - Check frequency in ms (default: 5000)

## 5. Behavior Flow

1. Detect version files in project path
2. Parse version specification
3. Check if version is installed
4. Auto-switch if enabled and version available
5. Silent failure - no user interruption
