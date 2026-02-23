# Spec Delta: Project-file-driven environment detection

## MODIFIED Requirements

### Requirement: Version Detection

The system SHALL automatically detect required environment versions by traversing the directory tree and inspecting **project files**, independent of which version manager provider is currently installed.

#### Scenario: Detect version from local version files

- **WHEN** a project contains version pinning files in the current or parent directory (e.g., `.nvmrc`, `.python-version`, `rust-toolchain`)
- **THEN** the system returns the version specified in the nearest relevant file
- **AND** `env_type` is the logical type (`node`, `python`, `go`, `rust`, ...)
- **AND** `source` is a concrete label matching the configured detection source (e.g., `.nvmrc`)

#### Scenario: Detect version from structured manifests

- **WHEN** a project contains a structured manifest for version pinning (e.g., `go.mod`, `global.json`, `package.json`)
- **THEN** the system extracts the correct runtime version field for the relevant `env_type`
- **AND** `source` identifies the exact field (e.g., `go.mod (toolchain)`, `global.json (sdk.version)`, `package.json (volta.node)`)

## ADDED Requirements

### Requirement: Correct Precedence and Avoiding Misleading Sources

The system SHALL follow upstream semantics for precedence and MUST avoid sources that are not runtime version pinning.

#### Scenario: Go toolchain takes precedence over go directive

- **WHEN** `go.mod` contains both `toolchain` and `go` directives
- **THEN** the detected version uses `toolchain` rather than `go`

#### Scenario: Do not treat package version as Deno runtime version

- **WHEN** `deno.json` contains a `"version"` field used for package publishing
- **THEN** the system MUST NOT treat that value as a Deno runtime version

#### Scenario: Bun behavior config does not imply runtime version

- **WHEN** a project contains `bunfig.toml`
- **THEN** the system MUST NOT interpret it as a Bun runtime version pinning source

